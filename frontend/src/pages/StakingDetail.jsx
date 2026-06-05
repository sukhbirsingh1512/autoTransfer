import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import AddressLink from '../components/AddressLink';
import TxLink from '../components/TxLink';
import { apiGet } from '../api/client';
import { formatDate } from '../lib/format';

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-900 last:border-0">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export default function StakingDetail() {
  const { id } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['staking', id],
    queryFn: () => apiGet(`/staking/${id}`),
    refetchInterval: 5_000,
  });

  if (isLoading) return <div className="text-slate-500 text-sm">Loading…</div>;
  const r = data?.request;
  if (!r) return <div className="text-slate-500 text-sm">Not found</div>;

  return (
    <>
      <PageHeader
        title="Staking Request"
        subtitle={r._id}
        actions={<Link to="/staking" className="btn-ghost">Back</Link>}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-2 text-slate-300">Overview</h2>
          <Row label="Status"><StatusBadge status={r.status} /></Row>
          <Row label="Created">{formatDate(r.createdAt)}</Row>
          <Row label="Updated">{formatDate(r.updatedAt)}</Row>
          <Row label="Amount (USDT)"><span className="font-mono">{r.stakingAmount}</span></Row>
          <Row label="USDT decimals">{r.usdtDecimals}</Row>
          <Row label="Monitoring wallet"><AddressLink address={r.monitoringWalletAddress} /></Row>
          <Row label="Funding wallet"><AddressLink address={r.masterFundingWalletAddress} /></Row>
          <Row label="Referrer"><AddressLink address={r.referrerAddress} /></Row>
          <Row label="USDT contract"><AddressLink address={r.usdtContractAddress} /></Row>
          <Row label="Staking contract"><AddressLink address={r.stakingContractAddress} /></Row>
          {r.errorMessage && (
            <Row label="Error"><span className="text-rose-400">{r.errorMessage}</span></Row>
          )}
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-2 text-slate-300">Transactions</h2>
          <Row label="Funding wallet gas top-up"><TxLink hash={r.fundingWalletGasTopUpTxHash} /></Row>
          <Row label="USDT funding"><TxLink hash={r.fundingTxHash} /></Row>
          <Row label="Monitoring wallet gas top-up"><TxLink hash={r.monitoringWalletGasTopUpTxHash} /></Row>
          <Row label="USDT allowance"><TxLink hash={r.allowanceTxHash} /></Row>
          <Row label="Staking call"><TxLink hash={r.stakingTxHash} /></Row>
          <Row label="Retry count">{r.retryCount}</Row>
        </div>
      </div>

      {data?.funding?.length > 0 && (
        <div className="card mt-4 overflow-x-auto">
          <div className="px-5 py-3 border-b border-slate-800 text-sm font-semibold">Funding records</div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Created</th>
                <th className="th">Amount</th>
                <th className="th">Status</th>
                <th className="th">Tx</th>
              </tr>
            </thead>
            <tbody className="table-zebra">
              {data.funding.map((f) => (
                <tr key={f._id}>
                  <td className="td text-xs text-slate-500">{formatDate(f.createdAt)}</td>
                  <td className="td font-mono">{f.amount}</td>
                  <td className="td"><StatusBadge status={f.status} /></td>
                  <td className="td"><TxLink hash={f.fundingTxHash} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
