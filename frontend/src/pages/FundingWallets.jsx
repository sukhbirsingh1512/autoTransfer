import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2, Pencil, RefreshCw } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import AddressLink from '../components/AddressLink';
import { apiDelete, apiGet, apiPost, apiPut } from '../api/client';
import { DEFAULT_USDT } from '../lib/format';

const EMPTY = {
  walletName: '',
  walletAddress: '',
  privateKey: '',
  usdtContractAddress: DEFAULT_USDT,
  priority: 100,
  minimumUsdtBalanceAlert: '100',
  minimumBnbBalanceAlert: '0.01',
  notes: '',
};

export default function FundingWallets() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [balances, setBalances] = useState({});

  const { data, isLoading } = useQuery({ queryKey: ['funding-wallets'], queryFn: () => apiGet('/funding-wallets') });

  const create = useMutation({
    mutationFn: (body) => apiPost('/funding-wallets', body),
    onSuccess: () => { toast.success('Funding wallet added'); qc.invalidateQueries({ queryKey: ['funding-wallets'] }); close(); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Create failed'),
  });
  const update = useMutation({
    mutationFn: ({ id, body }) => apiPut(`/funding-wallets/${id}`, body),
    onSuccess: () => { toast.success('Updated'); qc.invalidateQueries({ queryKey: ['funding-wallets'] }); close(); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Update failed'),
  });
  const del = useMutation({
    mutationFn: (id) => apiDelete(`/funding-wallets/${id}`),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['funding-wallets'] }); },
  });

  const fetchBalance = async (id) => {
    try {
      const d = await apiGet(`/funding-wallets/${id}/balance`);
      setBalances((b) => ({ ...b, [id]: d }));
    } catch { toast.error('Balance check failed'); }
  };

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (w) => { setEditing(w); setForm({ ...EMPTY, ...w, privateKey: '' }); setOpen(true); };
  const close = () => { setOpen(false); setEditing(null); setForm(EMPTY); };

  const onSubmit = (e) => {
    e.preventDefault();
    if (editing) {
      const body = { ...form };
      if (!body.privateKey) delete body.privateKey;
      delete body.walletAddress;
      delete body.usdtContractAddress;
      update.mutate({ id: editing._id, body });
    } else create.mutate(form);
  };

  return (
    <>
      <PageHeader
        title="Master Funding Wallets"
        subtitle="USDT pool used to fund monitoring wallets for staking"
        actions={<button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4" /> Add Funding Wallet</button>}
      />
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Name</th>
              <th className="th">Address</th>
              <th className="th">Priority</th>
              <th className="th">USDT</th>
              <th className="th">BNB</th>
              <th className="th">Status</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="table-zebra">
            {isLoading && <tr><td className="td text-slate-500" colSpan={7}>Loading…</td></tr>}
            {(data?.wallets || []).map((w) => {
              const b = balances[w._id];
              return (
                <tr key={w._id}>
                  <td className="td">{w.walletName}</td>
                  <td className="td"><AddressLink address={w.walletAddress} /></td>
                  <td className="td font-mono">{w.priority}</td>
                  <td className="td font-mono">
                    {b ? `${Number(b.usdt).toFixed(2)}` : '—'}
                    <button onClick={() => fetchBalance(w._id)} className="ml-2 text-slate-500 hover:text-brand-400">
                      <RefreshCw className="w-3 h-3 inline" />
                    </button>
                  </td>
                  <td className="td font-mono text-xs">{b ? Number(b.bnb).toFixed(6) : '—'}</td>
                  <td className="td"><StatusBadge status={w.status} /></td>
                  <td className="td">
                    <div className="flex items-center gap-1 justify-end">
                      <button className="btn-ghost h-8 px-2" onClick={() => openEdit(w)}><Pencil className="w-3.5 h-3.5" /></button>
                      <button className="btn-ghost h-8 px-2 text-rose-400" onClick={() => { if (confirm('Delete?')) del.mutate(w._id); }}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!isLoading && data?.wallets?.length === 0 && <tr><td className="td text-slate-500" colSpan={7}>No funding wallets yet</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={close} title={editing ? 'Edit Funding Wallet' : 'Add Master Funding Wallet'} maxWidth="max-w-xl">
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Name</label><input className="input" required value={form.walletName} onChange={(e) => setForm({ ...form, walletName: e.target.value })} /></div>
            <div><label className="label">Address</label><input className="input" required disabled={!!editing} value={form.walletAddress} onChange={(e) => setForm({ ...form, walletAddress: e.target.value })} /></div>
          </div>
          <div>
            <label className="label">{editing ? 'Private key (leave blank to keep)' : 'Private key'}</label>
            <input type="password" className="input" required={!editing} value={form.privateKey} onChange={(e) => setForm({ ...form, privateKey: e.target.value })} autoComplete="new-password" />
          </div>
          {!editing && (
            <div><label className="label">USDT contract</label><input className="input" value={form.usdtContractAddress} onChange={(e) => setForm({ ...form, usdtContractAddress: e.target.value })} /></div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Priority</label><input type="number" className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} /></div>
            <div><label className="label">Min USDT alert</label><input className="input" value={form.minimumUsdtBalanceAlert} onChange={(e) => setForm({ ...form, minimumUsdtBalanceAlert: e.target.value })} /></div>
            <div><label className="label">Min BNB alert</label><input className="input" value={form.minimumBnbBalanceAlert} onChange={(e) => setForm({ ...form, minimumBnbBalanceAlert: e.target.value })} /></div>
          </div>
          <div><label className="label">Notes</label><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={create.isPending || update.isPending}>{editing ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
