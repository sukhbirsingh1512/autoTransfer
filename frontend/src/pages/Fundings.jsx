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

export default function Fundings() {
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['fundings', page],
    queryFn: () => apiGet(`/fundings?page=${page}&limit=25`),
    refetchInterval: 15_000,
  });
  const retry = useMutation({
    mutationFn: (id) => apiPost(`/fundings/${id}/retry`),
    onSuccess: () => {
      toast.success('Retry queued');
      qc.invalidateQueries({ queryKey: ['fundings'] });
    },
  });

  return (
    <>
      <PageHeader title="Funding History" subtitle="USDT transfers from Master Funding Wallets" />
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Created</th>
              <th className="th">Funding wallet</th>
              <th className="th">Monitoring wallet</th>
              <th className="th">Amount</th>
              <th className="th">Status</th>
              <th className="th">Tx</th>
              <th className="th">Gas top-up</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="table-zebra">
            {isLoading && <tr><td className="td text-slate-500" colSpan={8}>Loading…</td></tr>}
            {(data?.items || []).map((f) => (
              <tr key={f._id}>
                <td className="td text-xs text-slate-500">{formatDate(f.createdAt)}</td>
                <td className="td"><AddressLink address={f.masterFundingWalletAddress} /></td>
                <td className="td"><AddressLink address={f.monitoringWalletAddress} /></td>
                <td className="td font-mono">{f.amount}</td>
                <td className="td"><StatusBadge status={f.status} /></td>
                <td className="td"><TxLink hash={f.fundingTxHash} /></td>
                <td className="td"><TxLink hash={f.gasTopUpTxHash} /></td>
                <td className="td">
                  {f.status === 'FAILED' && (
                    <button className="btn-ghost h-8 px-2 text-xs" onClick={() => retry.mutate(f._id)}>
                      <RefreshCw className="w-3 h-3" /> Retry
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!isLoading && data?.items?.length === 0 && <tr><td className="td text-slate-500" colSpan={8}>No funding records</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
