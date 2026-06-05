import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import AddressLink from '../components/AddressLink';
import TxLink from '../components/TxLink';
import { apiGet } from '../api/client';
import { formatDate } from '../lib/format';

export default function GasTopUps() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['gas-top-ups', page],
    queryFn: () => apiGet(`/transfers/gas-top-ups?page=${page}&limit=25`),
    refetchInterval: 20_000,
  });

  return (
    <>
      <PageHeader title="Gas Top-Ups" subtitle="BNB sent from Master Gas Wallets" />
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Created</th>
              <th className="th">From (Gas)</th>
              <th className="th">To</th>
              <th className="th">Type</th>
              <th className="th">BNB</th>
              <th className="th">Status</th>
              <th className="th">Tx</th>
            </tr>
          </thead>
          <tbody className="table-zebra">
            {isLoading && <tr><td className="td text-slate-500" colSpan={7}>Loading…</td></tr>}
            {(data?.items || []).map((g) => (
              <tr key={g._id}>
                <td className="td text-xs text-slate-500">{formatDate(g.createdAt)}</td>
                <td className="td"><AddressLink address={g.masterGasWalletAddress} /></td>
                <td className="td"><AddressLink address={g.receiverWalletAddress} /></td>
                <td className="td text-xs">{g.receiverWalletType}</td>
                <td className="td font-mono">{g.bnbAmount}</td>
                <td className="td"><StatusBadge status={g.status} /></td>
                <td className="td"><TxLink hash={g.transactionHash} /></td>
              </tr>
            ))}
            {!isLoading && data?.items?.length === 0 && <tr><td className="td text-slate-500" colSpan={7}>No top-ups yet</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
