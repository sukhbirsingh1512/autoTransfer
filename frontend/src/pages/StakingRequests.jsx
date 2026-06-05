import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, RefreshCw, X } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import AddressLink from '../components/AddressLink';
import TxLink from '../components/TxLink';
import { apiGet, apiPost } from '../api/client';
import { formatDate } from '../lib/format';

export default function StakingRequests() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: list, isLoading } = useQuery({
    queryKey: ['staking'],
    queryFn: () => apiGet('/staking?limit=50'),
    refetchInterval: 10_000,
  });

  const { data: wallets } = useQuery({ queryKey: ['wallets-for-staking'], queryFn: () => apiGet('/wallets') });

  const create = useMutation({
    mutationFn: (body) => apiPost('/staking', body),
    onSuccess: () => { toast.success('Staking request created'); qc.invalidateQueries({ queryKey: ['staking'] }); setOpen(false); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Create failed'),
  });

  const retry = useMutation({
    mutationFn: (id) => apiPost(`/staking/${id}/retry`),
    onSuccess: () => { toast.success('Retry queued'); qc.invalidateQueries({ queryKey: ['staking'] }); },
  });

  const cancel = useMutation({
    mutationFn: (id) => apiPost(`/staking/${id}/cancel`),
    onSuccess: () => { toast.success('Request cancelled'); qc.invalidateQueries({ queryKey: ['staking'] }); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Cancel failed'),
  });

  const [form, setForm] = useState({ monitoringWalletId: '', stakingAmount: '', referrerAddress: '' });

  return (
    <>
      <PageHeader
        title="Staking Requests"
        subtitle="USDT BEP20 staking via monitoring wallets"
        actions={<button className="btn-primary" onClick={() => setOpen(true)}><Plus className="w-4 h-4" /> Create Request</button>}
      />
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Created</th>
              <th className="th">Wallet</th>
              <th className="th">Amount (USDT)</th>
              <th className="th">Referrer</th>
              <th className="th">Status</th>
              <th className="th">Funding Tx</th>
              <th className="th">Allowance Tx</th>
              <th className="th">Stake Tx</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="table-zebra">
            {isLoading && <tr><td className="td text-slate-500" colSpan={9}>Loading…</td></tr>}
            {(list?.items || []).map((r) => (
              <tr key={r._id}>
                <td className="td text-xs text-slate-500">{formatDate(r.createdAt)}</td>
                <td className="td"><AddressLink address={r.monitoringWalletAddress} /></td>
                <td className="td font-mono">{r.stakingAmount}</td>
                <td className="td"><AddressLink address={r.referrerAddress} /></td>
                <td className="td"><StatusBadge status={r.status} /></td>
                <td className="td"><TxLink hash={r.fundingTxHash} /></td>
                <td className="td"><TxLink hash={r.allowanceTxHash} /></td>
                <td className="td"><TxLink hash={r.stakingTxHash} /></td>
                <td className="td">
                  <div className="flex items-center gap-1 justify-end">
                    <Link className="btn-ghost h-8 px-2 text-xs" to={`/staking/${r._id}`}>Details</Link>
                    {!r.stakingTxHash && !['STAKING_SUCCESS', 'CANCELLED'].includes(r.status) && (
                      <button className="btn-ghost h-8 px-2 text-xs text-rose-400" onClick={() => { if (confirm('Cancel?')) cancel.mutate(r._id); }}>
                        <X className="w-3 h-3" /> Cancel
                      </button>
                    )}
                    {r.status === 'STAKING_FAILED' && (
                      <button className="btn-ghost h-8 px-2 text-xs" onClick={() => retry.mutate(r._id)}>
                        <RefreshCw className="w-3 h-3" /> Retry
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && list?.items?.length === 0 && <tr><td className="td text-slate-500" colSpan={9}>No staking requests</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Create Staking Request">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(form); }} className="space-y-3">
          <div>
            <label className="label">Monitoring wallet</label>
            <select
              className="input"
              required
              value={form.monitoringWalletId}
              onChange={(e) => setForm({ ...form, monitoringWalletId: e.target.value })}
            >
              <option value="">Select wallet…</option>
              {(wallets?.wallets || [])
                .filter((w) => w.status === 'ACTIVE')
                .map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.walletName} · {w.walletAddress.slice(0, 8)}…{w.walletAddress.slice(-4)} · {w.walletMode}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="label">USDT staking amount</label>
            <input
              className="input"
              placeholder="100"
              required
              value={form.stakingAmount}
              onChange={(e) => setForm({ ...form, stakingAmount: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Referrer address</label>
            <input
              className="input"
              placeholder="0x…"
              required
              value={form.referrerAddress}
              onChange={(e) => setForm({ ...form, referrerAddress: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={create.isPending}>Create</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
