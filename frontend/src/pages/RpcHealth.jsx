import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle, XCircle } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { apiGet } from '../api/client';

export default function RpcHealth() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['rpc-health'],
    queryFn: () => apiGet('/dashboard/rpc'),
    refetchInterval: 30_000,
  });

  return (
    <>
      <PageHeader
        title="RPC Health"
        subtitle="HTTP endpoints used for reads and broadcasting"
        actions={<button className="btn-ghost" onClick={() => refetch()} disabled={isFetching}>Refresh</button>}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {isLoading && <div className="text-slate-500 text-sm">Loading…</div>}
        {(data?.rpcs || []).map((r) => (
          <div key={r.url} className="card p-4 flex items-start gap-3">
            <div className={`mt-0.5 ${r.healthy ? 'text-emerald-400' : 'text-rose-400'}`}>
              {r.healthy ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-xs break-all">{r.url}</div>
              <div className="mt-1 text-xs text-slate-500 flex items-center gap-1">
                <Activity className="w-3 h-3" />
                {r.healthy ? `block #${r.blockNumber}` : (r.error || 'unhealthy')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
