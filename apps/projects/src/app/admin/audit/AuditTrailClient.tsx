'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  projectId: string | null;
  detail: unknown;
  createdAt: Date;
  user: { firstName: string; lastName: string; email: string } | null;
};

export default function AuditTrailClient({
  logs, total, page, pageSize, entities, actions, filters,
}: {
  logs: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  entities: string[];
  actions: string[];
  filters: { entity: string; action: string };
}) {
  const router = useRouter();
  const [entity, setEntity] = useState(filters.entity);
  const [action, setAction] = useState(filters.action);

  function applyFilter() {
    const params = new URLSearchParams();
    if (entity) params.set('entity', entity);
    if (action) params.set('action', action);
    params.set('page', '1');
    router.push(`/admin/audit?${params.toString()}`);
  }

  function clearFilter() {
    setEntity('');
    setAction('');
    router.push('/admin/audit');
  }

  const totalPages = Math.ceil(total / pageSize);

  function goPage(p: number) {
    const params = new URLSearchParams();
    if (filters.entity) params.set('entity', filters.entity);
    if (filters.action) params.set('action', filters.action);
    params.set('page', String(p));
    router.push(`/admin/audit?${params.toString()}`);
  }

  function fmtDate(d: Date) {
    return new Date(d).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'medium' });
  }

  const ACTION_COLORS: Record<string, string> = {
    CREATE: 'bg-green-100 text-green-700',
    UPDATE: 'bg-blue-100 text-blue-700',
    DELETE: 'bg-red-100 text-red-700',
    ACTIVATE: 'bg-teal-100 text-teal-700',
    DEACTIVATE: 'bg-amber-100 text-amber-700',
    UPDATE_PERMISSIONS: 'bg-purple-100 text-purple-700',
    RESET_PERMISSIONS: 'bg-zinc-100 text-zinc-600',
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Audit trail</h1>
        <p className="text-sm text-zinc-500 mt-1">{total.toLocaleString()} events</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={entity} onChange={(e) => setEntity(e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">All entities</option>
          {entities.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={action} onChange={(e) => setAction(e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={applyFilter} className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand/90">Filter</button>
        {(filters.entity || filters.action) && (
          <button onClick={clearFilter} className="px-4 py-2 text-sm border border-zinc-200 text-zinc-600 rounded-lg hover:bg-zinc-50">Clear</button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500">Time</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500">User</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500">Action</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500">Entity</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500">Entity ID</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-zinc-400">No audit events found.</td></tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">{fmtDate(log.createdAt)}</td>
                <td className="px-4 py-3">
                  {log.user ? (
                    <div>
                      <div className="text-zinc-800 text-xs font-medium">{log.user.firstName} {log.user.lastName}</div>
                      <div className="text-zinc-400 text-xs">{log.user.email}</div>
                    </div>
                  ) : <span className="text-zinc-400 text-xs">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLORS[log.action] ?? 'bg-zinc-100 text-zinc-600'}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-700">{log.entity}</td>
                <td className="px-4 py-3 text-xs text-zinc-400 font-mono">{log.entityId ? log.entityId.substring(0, 8) + '…' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-zinc-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => goPage(page - 1)} disabled={page <= 1} className="px-3 py-1.5 text-sm border border-zinc-200 rounded-lg disabled:opacity-40 hover:bg-zinc-50">Previous</button>
            <button onClick={() => goPage(page + 1)} disabled={page >= totalPages} className="px-3 py-1.5 text-sm border border-zinc-200 rounded-lg disabled:opacity-40 hover:bg-zinc-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
