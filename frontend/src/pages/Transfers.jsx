import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { RefreshCw } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import AddressLink from '../components/AddressLink';
import TxLink from '../components/TxLink';
import { apiGet, apiPost } from '../api/client';
import { formatDate } from '../lib/format';

export default function Transfers() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['transfers', page, status],
    queryFn: () => apiGet(`/transfers?page=${page}&limit=25${status ? `&status=${status}` : ''}`),
    refetchInterval: 15_000,
  });

  const retry = useMutation({
    mutationFn: (id) => apiPost(`/transfers/${id}/retry`),
    onSuccess: () => {
      toast.success('Retry queued');
      qc.invalidateQueries({ queryKey: ['transfers'] });
    },
  });

  return (
    <>
      <PageHeader
        title="Transfers"
        subtitle="Auto-sweep history"
        actions={
          <select className="input w-full sm:w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option>DETECTED</option>
            <option>GAS_TOP_UP_PENDING</option>
            <option>GAS_READY</option>
            <option>BROADCAST</option>
            <option>CONFIRMED</option>
            <option>FAILED</option>
            <option>SKIPPED</option>
          </select>
        }
      />
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Created</th>
              <th className="th">Wallet</th>
              <th className="th">Token</th>
              <th className="th">Amount</th>
              <th className="th">Status</th>
              <th className="th">Incoming</th>
              <th className="th">Outgoing</th>
              <th className="th">Gas top-up</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="table-zebra">
            {isLoading && <tr><td className="td text-slate-500" colSpan={9}>Loading…</td></tr>}
            {(data?.items || []).map((t) => (
              <tr key={t._id}>
                <td className="td text-xs text-slate-500">{formatDate(t.createdAt)}</td>
                <td className="td"><AddressLink address={t.monitoringWalletAddress} /></td>
                <td className="td">{t.tokenSymbol}</td>
                <td className="td font-mono">{t.amount}</td>
                <td className="td"><StatusBadge status={t.status} /></td>
                <td className="td"><TxLink hash={t.incomingTxHash} /></td>
                <td className="td"><TxLink hash={t.outgoingTxHash} /></td>
                <td className="td"><TxLink hash={t.gasTopUpTxHash} /></td>
                <td className="td">
                  {t.status === 'FAILED' && (
                    <button className="btn-ghost h-8 px-2 text-xs" onClick={() => retry.mutate(t._id)}>
                      <RefreshCw className="w-3 h-3" /> Retry
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!isLoading && data?.items?.length === 0 && <tr><td className="td text-slate-500" colSpan={9}>No transfers</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination page={page} limit={data?.limit || 25} total={data?.total || 0} onPage={setPage} />
    </>
  );
}

function Pagination({ page, limit, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="flex items-center justify-between mt-4 text-xs text-slate-400">
      <div>{total} results</div>
      <div className="flex items-center gap-2">
        <button className="btn-ghost h-7 px-2 disabled:opacity-50" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</button>
        <span>Page {page} / {pages}</span>
        <button className="btn-ghost h-7 px-2 disabled:opacity-50" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}
