import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2, Pencil, RefreshCw } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import AddressLink from '../components/AddressLink';
import { apiDelete, apiGet, apiPost, apiPut } from '../api/client';

const EMPTY = { walletName: '', walletAddress: '', privateKey: '', priority: 100, minimumBalanceAlert: '0.1', notes: '' };

export default function GasWallets() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [balances, setBalances] = useState({});

  const { data, isLoading } = useQuery({ queryKey: ['gas-wallets'], queryFn: () => apiGet('/gas-wallets') });

  const create = useMutation({
    mutationFn: (body) => apiPost('/gas-wallets', body),
    onSuccess: () => { toast.success('Gas wallet added'); qc.invalidateQueries({ queryKey: ['gas-wallets'] }); close(); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Create failed'),
  });
  const update = useMutation({
    mutationFn: ({ id, body }) => apiPut(`/gas-wallets/${id}`, body),
    onSuccess: () => { toast.success('Updated'); qc.invalidateQueries({ queryKey: ['gas-wallets'] }); close(); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Update failed'),
  });
  const del = useMutation({
    mutationFn: (id) => apiDelete(`/gas-wallets/${id}`),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['gas-wallets'] }); },
  });

  const fetchBalance = async (id) => {
    try {
      const data = await apiGet(`/gas-wallets/${id}/balance`);
      setBalances((b) => ({ ...b, [id]: data.bnb }));
    } catch (e) {
      toast.error('Balance check failed');
    }
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
      update.mutate({ id: editing._id, body });
    } else create.mutate(form);
  };

  return (
    <>
      <PageHeader
        title="Master Gas Wallets"
        subtitle="BNB pool used for auto top-ups (priority-ordered)"
        actions={<button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4" /> Add Gas Wallet</button>}
      />
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Name</th>
              <th className="th">Address</th>
              <th className="th">Priority</th>
              <th className="th">Min alert</th>
              <th className="th">BNB</th>
              <th className="th">Status</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="table-zebra">
            {isLoading && <tr><td className="td text-slate-500" colSpan={7}>Loading…</td></tr>}
            {(data?.wallets || []).map((w) => (
              <tr key={w._id}>
                <td className="td">{w.walletName}</td>
                <td className="td"><AddressLink address={w.walletAddress} /></td>
                <td className="td font-mono">{w.priority}</td>
                <td className="td font-mono text-xs">{w.minimumBalanceAlert}</td>
                <td className="td font-mono">
                  {balances[w._id] != null ? `${Number(balances[w._id]).toFixed(6)} BNB` : '—'}
                  <button onClick={() => fetchBalance(w._id)} className="ml-2 text-slate-500 hover:text-brand-400" title="Refresh">
                    <RefreshCw className="w-3 h-3 inline" />
                  </button>
                </td>
                <td className="td"><StatusBadge status={w.status} /></td>
                <td className="td">
                  <div className="flex items-center gap-1 justify-end">
                    <button className="btn-ghost h-8 px-2" onClick={() => openEdit(w)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button className="btn-ghost h-8 px-2 text-rose-400" onClick={() => { if (confirm('Delete?')) del.mutate(w._id); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && data?.wallets?.length === 0 && <tr><td className="td text-slate-500" colSpan={7}>No gas wallets yet</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={close} title={editing ? 'Edit Gas Wallet' : 'Add Master Gas Wallet'}>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">Name</label><input className="input" required value={form.walletName} onChange={(e) => setForm({ ...form, walletName: e.target.value })} /></div>
            <div><label className="label">Address</label><input className="input" required disabled={!!editing} value={form.walletAddress} onChange={(e) => setForm({ ...form, walletAddress: e.target.value })} /></div>
          </div>
          <div>
            <label className="label">{editing ? 'Private key (leave blank to keep)' : 'Private key'}</label>
            <input type="password" className="input" required={!editing} value={form.privateKey} onChange={(e) => setForm({ ...form, privateKey: e.target.value })} autoComplete="new-password" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">Priority (lower = first)</label><input type="number" className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} /></div>
            <div><label className="label">Minimum balance alert (BNB)</label><input className="input" value={form.minimumBalanceAlert} onChange={(e) => setForm({ ...form, minimumBalanceAlert: e.target.value })} /></div>
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
