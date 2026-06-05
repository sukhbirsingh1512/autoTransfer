import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2, Pencil, Search } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import AddressLink from '../components/AddressLink';
import { apiDelete, apiGet, apiPost, apiPut } from '../api/client';

const EMPTY = { contractAddress: '', tokenName: '', tokenSymbol: '', decimals: '', minimumSweepAmount: '0', notes: '' };

export default function Tokens() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const { data, isLoading } = useQuery({ queryKey: ['tokens'], queryFn: () => apiGet('/tokens') });

  const create = useMutation({
    mutationFn: (body) => apiPost('/tokens', body),
    onSuccess: () => { toast.success('Token added'); qc.invalidateQueries({ queryKey: ['tokens'] }); close(); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Create failed'),
  });
  const update = useMutation({
    mutationFn: ({ id, body }) => apiPut(`/tokens/${id}`, body),
    onSuccess: () => { toast.success('Token updated'); qc.invalidateQueries({ queryKey: ['tokens'] }); close(); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Update failed'),
  });
  const del = useMutation({
    mutationFn: (id) => apiDelete(`/tokens/${id}`),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['tokens'] }); },
  });
  const fetchInfo = useMutation({
    mutationFn: (addr) => apiPost('/tokens/fetch-info', { contractAddress: addr }),
    onSuccess: (data) => setForm((f) => ({ ...f, tokenName: data.name || f.tokenName, tokenSymbol: data.symbol || f.tokenSymbol, decimals: data.decimals ?? f.decimals })),
    onError: (e) => toast.error(e?.response?.data?.error || 'Fetch failed'),
  });

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (t) => { setEditing(t); setForm({ ...t }); setOpen(true); };
  const close = () => { setOpen(false); setEditing(null); setForm(EMPTY); };

  const onSubmit = (e) => {
    e.preventDefault();
    const body = { ...form, decimals: form.decimals === '' ? undefined : Number(form.decimals) };
    if (editing) { delete body.contractAddress; update.mutate({ id: editing._id, body }); }
    else create.mutate(body);
  };

  return (
    <>
      <PageHeader
        title="BEP20 Tokens"
        subtitle="Tokens monitored for incoming deposits"
        actions={<button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4" /> Add Token</button>}
      />
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Symbol</th>
              <th className="th">Name</th>
              <th className="th">Contract</th>
              <th className="th">Decimals</th>
              <th className="th">Min Sweep</th>
              <th className="th">Status</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="table-zebra">
            {isLoading && <tr><td className="td text-slate-500" colSpan={7}>Loading…</td></tr>}
            {(data?.tokens || []).map((t) => (
              <tr key={t._id}>
                <td className="td font-semibold">{t.tokenSymbol}</td>
                <td className="td">{t.tokenName}</td>
                <td className="td"><AddressLink address={t.contractAddress} /></td>
                <td className="td font-mono">{t.decimals}</td>
                <td className="td font-mono text-xs">{t.minimumSweepAmount}</td>
                <td className="td"><StatusBadge status={t.status} /></td>
                <td className="td">
                  <div className="flex items-center gap-1 justify-end">
                    <button className="btn-ghost h-8 px-2" onClick={() => openEdit(t)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="btn-ghost h-8 px-2 text-rose-400"
                      onClick={() => { if (confirm('Delete this token?')) del.mutate(t._id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && data?.tokens?.length === 0 && <tr><td className="td text-slate-500" colSpan={7}>No tokens yet</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={close} title={editing ? 'Edit Token' : 'Add BEP20 Token'}>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="label">Contract address</label>
              <input className="input" disabled={!!editing} value={form.contractAddress} onChange={(e) => setForm({ ...form, contractAddress: e.target.value })} required />
            </div>
            {!editing && (
              <button type="button" className="btn-ghost" onClick={() => form.contractAddress && fetchInfo.mutate(form.contractAddress)} disabled={fetchInfo.isPending}>
                <Search className="w-4 h-4" /> Fetch
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Symbol</label>
              <input className="input" value={form.tokenSymbol} onChange={(e) => setForm({ ...form, tokenSymbol: e.target.value })} />
            </div>
            <div>
              <label className="label">Name</label>
              <input className="input" value={form.tokenName} onChange={(e) => setForm({ ...form, tokenName: e.target.value })} />
            </div>
            <div>
              <label className="label">Decimals</label>
              <input className="input" type="number" min={0} max={36} value={form.decimals} onChange={(e) => setForm({ ...form, decimals: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Minimum sweep amount (human)</label>
            <input className="input" value={form.minimumSweepAmount} onChange={(e) => setForm({ ...form, minimumSweepAmount: e.target.value })} />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={create.isPending || update.isPending}>{editing ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
