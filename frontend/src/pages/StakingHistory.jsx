import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import AddressLink from '../components/AddressLink';
import TxLink from '../components/TxLink';
import { apiGet } from '../api/client';
import { formatDate } from '../lib/format';

export default function StakingHistory() {
  const [status, setStatus] = useState('STAKING_SUCCESS');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['staking-history', status, page],
    queryFn: () => apiGet(`/staking?status=${status}&page=${page}&limit=25`),
  });

  return (
    <>
      <PageHeader
        title="Staking History"
        actions={
          <select className="input w-56" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="STAKING_SUCCESS">Successful</option>
            <option value="STAKING_FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        }
      />
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Created</th>
              <th className="th">Wallet</th>
              <th className="th">Amount</th>
              <th className="th">Status</th>
              <th className="th">Stake Tx</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="table-zebra">
            {isLoading && <tr><td className="td text-slate-500" colSpan={6}>Loading…</td></tr>}
            {(data?.items || []).map((r) => (
              <tr key={r._id}>
                <td className="td text-xs text-slate-500">{formatDate(r.createdAt)}</td>
                <td className="td"><AddressLink address={r.monitoringWalletAddress} /></td>
                <td className="td font-mono">{r.stakingAmount}</td>
                <td className="td"><StatusBadge status={r.status} /></td>
                <td className="td"><TxLink hash={r.stakingTxHash} /></td>
                <td className="td"><Link className="text-brand-400 text-xs" to={`/staking/${r._id}`}>Details</Link></td>
              </tr>
            ))}
            {!isLoading && data?.items?.length === 0 && <tr><td className="td text-slate-500" colSpan={6}>None</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
