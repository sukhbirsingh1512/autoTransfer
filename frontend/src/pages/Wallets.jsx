import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2, Pencil, RotateCcw } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import AddressLink from '../components/AddressLink';
import GasModeField from '../components/GasModeField';
import { apiDelete, apiGet, apiPost, apiPut } from '../api/client';
import { formatDate } from '../lib/format';

const EMPTY = {
  walletName: '',
  walletAddress: '',
  privateKey: '',
  secureReceivingWallet: '',
  minimumGasBalance: '0.001',
  topUpAmount: '0.002',
  gasMode: 'ESTIMATED',
  notes: '',
};

export default function Wallets() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const { data, isLoading } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => apiGet('/wallets'),
    refetchInterval: 15_000,
  });

  const create = useMutation({
    mutationFn: (body) => apiPost('/wallets', body),
    onSuccess: () => {
      toast.success('Wallet created');
      qc.invalidateQueries({ queryKey: ['wallets'] });
      close();
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Create failed'),
  });

  const update = useMutation({
    mutationFn: ({ id, body }) => apiPut(`/wallets/${id}`, body),
    onSuccess: () => {
      toast.success('Wallet updated');
      qc.invalidateQueries({ queryKey: ['wallets'] });
      close();
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Update failed'),
  });

  const del = useMutation({
    mutationFn: (id) => apiDelete(`/wallets/${id}`),
    onSuccess: () => {
      toast.success('Wallet deleted');
      qc.invalidateQueries({ queryKey: ['wallets'] });
    },
  });

  const release = useMutation({
    mutationFn: (id) => apiPost(`/wallets/${id}/release`),
    onSuccess: () => {
      toast.success('Wallet released');
      qc.invalidateQueries({ queryKey: ['wallets'] });
    },
  });

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
    } else {
      create.mutate(form);
    }
  };

  return (
    <>
      <PageHeader
        title="Monitoring Wallets"
        subtitle="Wallets watched for incoming BEP20 deposits"
        actions={<button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4" /> Add Wallet</button>}
      />
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Name</th>
              <th className="th">Address</th>
              <th className="th">Secure Receiving</th>
              <th className="th">Mode</th>
              <th className="th">Status</th>
              <th className="th">Gas</th>
              <th className="th">Min/Top-up BNB</th>
              <th className="th">Created</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="table-zebra">
            {isLoading && <tr><td className="td text-slate-500" colSpan={9}>Loading…</td></tr>}
            {(data?.wallets || []).map((w) => (
              <tr key={w._id}>
                <td className="td">{w.walletName}</td>
                <td className="td"><AddressLink address={w.walletAddress} /></td>
                <td className="td"><AddressLink address={w.secureReceivingWallet} /></td>
                <td className="td"><StatusBadge status={w.walletMode} /></td>
                <td className="td"><StatusBadge status={w.status} /></td>
                <td className="td">
                  <span className={`badge ${w.gasMode === 'ESTIMATED' ? 'badge-info' : 'badge-muted'}`}>
                    {w.gasMode === 'ESTIMATED' ? 'Estimated' : 'Fixed'}
                  </span>
                </td>
                <td className="td font-mono text-xs">{w.minimumGasBalance} / {w.topUpAmount}</td>
                <td className="td text-xs text-slate-500">{formatDate(w.createdAt)}</td>
                <td className="td">
                  <div className="flex items-center gap-1 justify-end">
                    {w.walletMode !== 'ACTIVE_MONITORING' && (
                      <button
                        className="btn-ghost h-8 px-2"
                        onClick={() => release.mutate(w._id)}
                        title="Release back to monitoring"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button className="btn-ghost h-8 px-2" onClick={() => openEdit(w)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="btn-ghost h-8 px-2 text-rose-400"
                      onClick={() => { if (confirm('Delete this wallet?')) del.mutate(w._id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && data?.wallets?.length === 0 && (
              <tr><td className="td text-slate-500" colSpan={9}>No wallets yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={close} title={editing ? 'Edit Wallet' : 'Add Monitoring Wallet'} maxWidth="max-w-xl">
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Wallet name" value={form.walletName} onChange={(v) => setForm({ ...form, walletName: v })} required />
            <Field label="Address (0x…)" value={form.walletAddress} onChange={(v) => setForm({ ...form, walletAddress: v })} disabled={!!editing} required />
          </div>
          <Field
            label={editing ? 'Private key (leave blank to keep)' : 'Private key'}
            value={form.privateKey}
            onChange={(v) => setForm({ ...form, privateKey: v })}
            type="password"
            required={!editing}
          />
          <Field label="Secure receiving wallet" value={form.secureReceivingWallet} onChange={(v) => setForm({ ...form, secureReceivingWallet: v })} required />
          <GasModeField
            value={form.gasMode}
            onChange={(v) => setForm({ ...form, gasMode: v })}
          />
          {form.gasMode === 'FIXED' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Minimum BNB balance" value={form.minimumGasBalance} onChange={(v) => setForm({ ...form, minimumGasBalance: v })} />
              <Field label="Top-up BNB amount" value={form.topUpAmount} onChange={(v) => setForm({ ...form, topUpAmount: v })} />
            </div>
          )}
          <Field label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={close}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={create.isPending || update.isPending}>
              {editing ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function Field({ label, value, onChange, type = 'text', required, disabled }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        className="input"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        autoComplete={type === 'password' ? 'new-password' : 'off'}
      />
    </div>
  );
}
