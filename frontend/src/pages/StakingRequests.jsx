import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, RefreshCw, X, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
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

  const [form, setForm] = useState({ monitoringWalletId: '', stakingAmount: '' });

  // Auto-fetch the staking-contract `users(address)` record when the admin picks
  // a wallet, so we can show the on-chain referrer + registration status inline.
  const { data: walletInfo, isFetching: infoLoading } = useQuery({
    queryKey: ['staking-wallet-info', form.monitoringWalletId],
    queryFn: () => apiGet(`/staking/wallet-info/${form.monitoringWalletId}`),
    enabled: Boolean(form.monitoringWalletId),
    staleTime: 30_000,
  });

  const onChainReferrer = walletInfo?.user?.referrer;
  const isRegistered = walletInfo?.user?.isExist;
  const referrerOk =
    isRegistered &&
    onChainReferrer &&
    onChainReferrer.toLowerCase() !== '0x0000000000000000000000000000000000000000';

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

          {/* Auto-fetched contract info: referrer + registration */}
          <ContractInfoPanel
            walletSelected={Boolean(form.monitoringWalletId)}
            loading={infoLoading}
            info={walletInfo}
          />

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button
              type="submit"
              className="btn-primary"
              disabled={create.isPending || !referrerOk}
              title={!referrerOk ? 'Selected wallet must be registered in the staking contract' : ''}
            >
              {create.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function ContractInfoPanel({ walletSelected, loading, info }) {
  if (!walletSelected) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2.5 text-xs text-slate-500">
        Select a monitoring wallet — the referrer will be read from the staking contract.
      </div>
    );
  }
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2.5 text-xs text-slate-400 flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading <code className="text-slate-500">users(walletAddress)</code> from contract…
      </div>
    );
  }
  if (info?.error) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-300 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold mb-0.5">Contract read failed</div>
          <div className="text-rose-200/80 break-all">{info.error}</div>
        </div>
      </div>
    );
  }
  const u = info?.user;
  if (!u?.isExist) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold mb-0.5">Not registered</div>
          <div className="text-amber-200/80">
            This wallet has no record in the staking contract. Register it on-chain first, then come back.
          </div>
        </div>
      </div>
    );
  }
  const zero = '0x0000000000000000000000000000000000000000';
  const isZeroReferrer = !u.referrer || u.referrer.toLowerCase() === zero;
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-xs">
      <div className="flex items-center gap-2 text-emerald-300 font-semibold mb-1.5">
        <CheckCircle2 className="w-4 h-4" /> Registered in staking contract
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-slate-300">
        <Row label="User ID" value={u.userId} />
        <Row label="Joining time" value={u.joiningTime ? new Date(u.joiningTime * 1000).toLocaleString() : '—'} />
        <Row
          label="Referrer"
          value={
            isZeroReferrer ? (
              <span className="text-rose-300">zero address — cannot proceed</span>
            ) : (
              <AddressLink address={u.referrer} />
            )
          }
        />
        <Row label="Booster" value={u.booster ? 'yes' : 'no'} />
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-slate-500 uppercase tracking-wider text-[10px] w-20 shrink-0">{label}</span>
      <span className="truncate">{value}</span>
    </div>
  );
}
