import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../components/PageHeader';
import { apiGet } from '../api/client';
import { formatDate } from '../lib/format';

export default function Logs() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['logs', page],
    queryFn: () => apiGet(`/logs?page=${page}&limit=50`),
  });

  return (
    <>
      <PageHeader title="Admin Logs" subtitle="Recent admin activity" />
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Time</th>
              <th className="th">Admin</th>
              <th className="th">Module</th>
              <th className="th">Action</th>
              <th className="th">IP</th>
              <th className="th">Path</th>
            </tr>
          </thead>
          <tbody className="table-zebra">
            {isLoading && <tr><td className="td text-slate-500" colSpan={6}>Loading…</td></tr>}
            {(data?.items || []).map((l) => (
              <tr key={l._id}>
                <td className="td text-xs text-slate-500">{formatDate(l.createdAt)}</td>
                <td className="td text-xs">{l.adminId?.email || '—'}</td>
                <td className="td text-xs">{l.module}</td>
                <td className="td text-xs">{l.action}</td>
                <td className="td text-xs font-mono">{l.ipAddress}</td>
                <td className="td text-xs font-mono text-slate-500">{l.details?.path}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
