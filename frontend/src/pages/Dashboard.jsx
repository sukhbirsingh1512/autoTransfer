import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../api/client';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import AddressLink from '../components/AddressLink';
import TxLink from '../components/TxLink';
import { formatDate } from '../lib/format';

function Stat({ label, value, sub }) {
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value ?? '—'}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiGet('/dashboard'),
    refetchInterval: 15_000,
  });

  return (
    <>
      <PageHeader title="Dashboard" subtitle="System overview" />
      {isLoading ? (
        <div className="text-slate-500 text-sm">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat
              label="Monitoring Wallets"
              value={data?.wallets?.total}
              sub={`${data?.wallets?.active || 0} active · ${data?.wallets?.paused || 0} paused`}
            />
            <Stat label="BEP20 Tokens" value={data?.tokens} />
            <Stat label="Master Gas Wallets" value={data?.gasWallets} />
            <Stat label="Master Funding Wallets" value={data?.fundingWallets} />
            <Stat
              label="Transfers"
              value={data?.transfers?.total}
              sub={`${data?.transfers?.successful || 0} ok · ${data?.transfers?.failed || 0} failed · ${data?.transfers?.pending || 0} pending`}
            />
            <Stat label="Gas Top-Ups" value={data?.gasTopUps} />
            <Stat label="Fundings" value={data?.fundings} />
            <Stat
              label="Staking Requests"
              value={data?.staking?.total}
              sub={`${data?.staking?.success || 0} ok · ${data?.staking?.failed || 0} failed · ${data?.staking?.pending || 0} pending`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
            <RecentList
              title="Recent transfers"
              items={data?.recent?.transfers}
              render={(t) => (
                <tr key={t._id}>
                  <td className="td"><AddressLink address={t.monitoringWalletAddress} /></td>
                  <td className="td">{t.tokenSymbol}</td>
                  <td className="td font-mono">{t.amount}</td>
                  <td className="td"><StatusBadge status={t.status} /></td>
                  <td className="td"><TxLink hash={t.outgoingTxHash || t.incomingTxHash} /></td>
                </tr>
              )}
              headers={['Wallet', 'Token', 'Amount', 'Status', 'Tx']}
            />
            <RecentList
              title="Recent staking"
              items={data?.recent?.stakings}
              render={(s) => (
                <tr key={s._id}>
                  <td className="td"><AddressLink address={s.monitoringWalletAddress} /></td>
                  <td className="td font-mono">{s.stakingAmount}</td>
                  <td className="td"><StatusBadge status={s.status} /></td>
                  <td className="td"><TxLink hash={s.stakingTxHash} /></td>
                  <td className="td text-slate-500 text-xs">{formatDate(s.createdAt)}</td>
                </tr>
              )}
              headers={['Wallet', 'USDT', 'Status', 'Tx', 'Created']}
            />
            <RecentList
              title="Recent fundings"
              items={data?.recent?.fundings}
              render={(f) => (
                <tr key={f._id}>
                  <td className="td"><AddressLink address={f.monitoringWalletAddress} /></td>
                  <td className="td font-mono">{f.amount}</td>
                  <td className="td"><StatusBadge status={f.status} /></td>
                  <td className="td"><TxLink hash={f.fundingTxHash} /></td>
                </tr>
              )}
              headers={['Wallet', 'USDT', 'Status', 'Tx']}
            />
            <RecentList
              title="Recent gas top-ups"
              items={data?.recent?.gasTopUps}
              render={(g) => (
                <tr key={g._id}>
                  <td className="td"><AddressLink address={g.receiverWalletAddress} /></td>
                  <td className="td font-mono">{g.bnbAmount} BNB</td>
                  <td className="td"><StatusBadge status={g.status} /></td>
                  <td className="td"><TxLink hash={g.transactionHash} /></td>
                </tr>
              )}
              headers={['Receiver', 'Amount', 'Status', 'Tx']}
            />
          </div>
        </>
      )}
    </>
  );
}

function RecentList({ title, items, render, headers }) {
  return (
    <div className="card">
      <div className="px-5 py-4 border-b border-slate-800 text-sm font-medium">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>{headers.map((h) => <th key={h} className="th">{h}</th>)}</tr>
          </thead>
          <tbody className="table-zebra">
            {(items || []).map(render)}
            {(!items || items.length === 0) && (
              <tr><td className="td text-slate-500 text-sm" colSpan={headers.length}>No recent activity</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
