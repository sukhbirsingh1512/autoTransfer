import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2, ShieldCheck, AlertTriangle, Zap, Loader2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import AddressLink from '../components/AddressLink';
import TxLink from '../components/TxLink';
import { apiGet, apiPost } from '../api/client';
import { formatDate } from '../lib/format';

export default function Sweeper() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ monitoringWalletId: '', tokenId: '' });

  const { data: status } = useQuery({
    queryKey: ['sweeper-status'],
    queryFn: () => apiGet('/sweeper/status'),
    refetchInterval: 30_000,
  });
  const { data: approvals, isLoading } = useQuery({
    queryKey: ['sweeper-approvals'],
    queryFn: () => apiGet('/sweeper/approvals'),
    refetchInterval: 10_000,
  });
  const { data: wallets } = useQuery({ queryKey: ['wallets'], queryFn: () => apiGet('/wallets') });
  const { data: tokens } = useQuery({ queryKey: ['tokens'], queryFn: () => apiGet('/tokens') });

  const setup = useMutation({
    mutationFn: (body) => apiPost('/sweeper/approvals', body),
    onSuccess: (data) => {
      toast.success(data.reused ? 'Already approved' : 'Sweeper approval confirmed');
      qc.invalidateQueries({ queryKey: ['sweeper-approvals'] });
      setOpen(false);
      setForm({ monitoringWalletId: '', tokenId: '' });
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Setup failed'),
  });

  const revoke = useMutation({
    mutationFn: (id) => apiPost(`/sweeper/approvals/${id}/revoke`),
    onSuccess: () => {
      toast.success('Marked as revoked');
      qc.invalidateQueries({ queryKey: ['sweeper-approvals'] });
    },
  });

  const isConfigured = Boolean(status?.sweeperContract);

  return (
    <>
      <PageHeader
        title="Sweeper Contract"
        subtitle="Gasless single-tx sweeps for compromised wallets"
        actions={
          isConfigured ? (
            <button className="btn-primary" onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4" /> Set up approval
            </button>
          ) : null
        }
      />

      {/* Top status card */}
      <div className="card p-4 sm:p-5 mb-5">
        {isConfigured ? (
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2 mt-0.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">Sweeper deployed</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-xs">
                <div>
                  <div className="text-slate-500 uppercase tracking-wider text-[10px] mb-0.5">Contract</div>
                  <AddressLink address={status.sweeperContract} />
                </div>
                <div>
                  <div className="text-slate-500 uppercase tracking-wider text-[10px] mb-0.5">Owner (relay)</div>
                  {status.owner ? <AddressLink address={status.owner} /> : <span className="text-slate-500">—</span>}
                </div>
              </div>
              {status.error && (
                <div className="mt-2 text-xs text-rose-300">Error reading contract: {status.error}</div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-amber-500/10 p-2 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">No sweeper contract configured</div>
              <div className="text-xs text-slate-400 mt-1">
                Set <code className="text-slate-300">SWEEPER_CONTRACT_ADDRESS</code> in <code>backend/.env</code>, then
                restart workers. Deploy with{' '}
                <code className="text-slate-300">npm run sweeper:build && npm run sweeper:deploy</code> from{' '}
                <code>backend/</code>.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Approvals table */}
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Created</th>
              <th className="th">Wallet</th>
              <th className="th">Token</th>
              <th className="th">Status</th>
              <th className="th">Approve Tx</th>
              <th className="th">Gas top-up Tx</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="table-zebra">
            {isLoading && (
              <tr>
                <td className="td text-slate-500" colSpan={7}>
                  Loading…
                </td>
              </tr>
            )}
            {(approvals?.items || []).map((a) => {
              const token = tokens?.tokens?.find((t) => t.contractAddress === a.tokenContractAddress);
              return (
                <tr key={a._id}>
                  <td className="td text-xs text-slate-500">{formatDate(a.createdAt)}</td>
                  <td className="td">
                    <AddressLink address={a.monitoringWalletAddress} />
                  </td>
                  <td className="td">{token?.tokenSymbol || a.tokenContractAddress.slice(0, 8)}</td>
                  <td className="td">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="td">
                    <TxLink hash={a.approvalTxHash} />
                  </td>
                  <td className="td">
                    <TxLink hash={a.gasTopUpTxHash} />
                  </td>
                  <td className="td">
                    {a.status === 'CONFIRMED' && (
                      <button
                        className="btn-ghost h-8 px-2 text-xs text-rose-400"
                        onClick={() => {
                          if (confirm('Mark this approval as revoked? (does not call the chain — only updates the record)')) {
                            revoke.mutate(a._id);
                          }
                        }}
                      >
                        <Trash2 className="w-3 h-3" /> Mark revoked
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!isLoading && approvals?.items?.length === 0 && (
              <tr>
                <td className="td text-slate-500" colSpan={7}>
                  No approvals yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Set up sweeper approval">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setup.mutate(form);
          }}
          className="space-y-3"
        >
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2.5 text-xs text-slate-400 flex items-start gap-2">
            <Zap className="w-4 h-4 mt-0.5 text-brand-400 shrink-0" />
            <div>
              One-time setup: we'll top up just enough BNB on the monitoring wallet to call{' '}
              <code className="text-slate-300">approve(sweeper, MAX)</code> once. After that, every sweep is a single
              tx from the relay wallet — no BNB ever needs to be in the compromised wallet again.
            </div>
          </div>

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
                    {w.walletName} · {w.walletAddress.slice(0, 8)}…{w.walletAddress.slice(-4)}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="label">Token</label>
            <select
              className="input"
              required
              value={form.tokenId}
              onChange={(e) => setForm({ ...form, tokenId: e.target.value })}
            >
              <option value="">Select token…</option>
              {(tokens?.tokens || [])
                .filter((t) => t.status === 'ACTIVE')
                .map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.tokenSymbol} · {t.contractAddress.slice(0, 10)}…
                  </option>
                ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={setup.isPending}>
              {setup.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Approving…
                </>
              ) : (
                'Approve'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
