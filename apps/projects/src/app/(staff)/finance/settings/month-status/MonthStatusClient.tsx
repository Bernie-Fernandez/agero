'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Status = 'OPEN' | 'READY' | 'SYNCED' | 'LOCKED';

type MonthStatus = {
  id: string;
  reportMonth: string;
  status: Status;
  markedReadyAt: string | null;
  xeroSyncedAt: string | null;
  lockedAt: string | null;
  notes: string | null;
  markedReadyBy: { firstName: string; lastName: string } | null;
};

const STATUS_BADGE: Record<Status, string> = {
  OPEN: 'bg-zinc-100 text-zinc-600',
  READY: 'bg-amber-100 text-amber-700',
  SYNCED: 'bg-green-100 text-green-700',
  LOCKED: 'bg-blue-100 text-blue-700',
};

function fmtMonth(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function MonthStatusClient({ statuses: initial }: { statuses: MonthStatus[] }) {
  const router = useRouter();
  const [statuses, setStatuses] = useState(initial);
  const [loading, setLoading] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState<{ type: 'ready' | 'sync' | 'lock'; id: string; month: string } | null>(null);

  async function markReady(id: string, month: string) {
    setLoading(id);
    const res = await fetch('/api/finance/month-status/mark-ready', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setStatuses((prev) => prev.map((s) => s.id === id ? { ...s, status: 'READY', markedReadyAt: new Date().toISOString() } : s));
      router.refresh();
    }
    setLoading(null);
    setConfirmOpen(null);
  }

  async function syncXero(id: string, month: string) {
    setLoading(id);
    setSyncResult(null);
    const reportMonth = new Date(month).toISOString().split('T')[0];
    const res = await fetch('/api/xero/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_month: reportMonth }),
    });
    const data = await res.json();
    if (res.ok) {
      setStatuses((prev) => prev.map((s) => s.id === id ? { ...s, status: 'SYNCED', xeroSyncedAt: new Date().toISOString() } : s));
      setSyncResult(`Sync complete — Revenue: $${Number(data.summary.revenue).toLocaleString()}, Net Profit: $${Number(data.summary.netProfit).toLocaleString()}, Debtor Days: ${data.summary.debtorDays}`);
      router.refresh();
    } else {
      setSyncResult(`Error: ${data.error}`);
    }
    setLoading(null);
    setConfirmOpen(null);
  }

  async function lockMonth(id: string) {
    setLoading(id);
    const res = await fetch('/api/finance/month-status/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setStatuses((prev) => prev.map((s) => s.id === id ? { ...s, status: 'LOCKED', lockedAt: new Date().toISOString() } : s));
      router.refresh();
    }
    setLoading(null);
    setConfirmOpen(null);
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">Month Status</h1>
        <p className="text-sm text-zinc-500 mt-1">Control the month-end gate before syncing Xero data.</p>
      </div>

      {syncResult && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${syncResult.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {syncResult}
        </div>
      )}

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Month</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Marked Ready By</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Ready At</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Xero Synced</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Locked</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {statuses.map((s) => (
              <tr key={s.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-medium text-zinc-900">{fmtMonth(s.reportMonth)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[s.status]}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {s.markedReadyBy ? `${s.markedReadyBy.firstName} ${s.markedReadyBy.lastName}` : '—'}
                </td>
                <td className="px-4 py-3 text-zinc-600">{fmtDate(s.markedReadyAt)}</td>
                <td className="px-4 py-3 text-zinc-600">{fmtDate(s.xeroSyncedAt)}</td>
                <td className="px-4 py-3 text-zinc-600">{fmtDate(s.lockedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {s.status === 'OPEN' && (
                      <button
                        onClick={() => setConfirmOpen({ type: 'ready', id: s.id, month: s.reportMonth })}
                        disabled={loading === s.id}
                        className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-md disabled:opacity-50"
                      >
                        Mark Ready
                      </button>
                    )}
                    {s.status === 'READY' && (
                      <button
                        onClick={() => setConfirmOpen({ type: 'sync', id: s.id, month: s.reportMonth })}
                        disabled={loading === s.id}
                        className="px-3 py-1 bg-brand hover:bg-brand/90 text-white text-xs font-medium rounded-md disabled:opacity-50"
                      >
                        {loading === s.id ? 'Syncing…' : 'Sync Xero'}
                      </button>
                    )}
                    {s.status === 'SYNCED' && (
                      <button
                        onClick={() => setConfirmOpen({ type: 'lock', id: s.id, month: s.reportMonth })}
                        disabled={loading === s.id}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md disabled:opacity-50"
                      >
                        Lock Month
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Confirmation Dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            {confirmOpen.type === 'ready' && (
              <>
                <h2 className="text-base font-semibold text-zinc-900 mb-2">Confirm Month Ready</h2>
                <p className="text-sm text-zinc-600 mb-6">
                  Confirm that journals are complete in Xero and{' '}
                  <strong>{fmtMonth(confirmOpen.month)}</strong> is ready to sync.
                  This will activate the Xero Sync button.
                </p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setConfirmOpen(null)} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">Cancel</button>
                  <button onClick={() => markReady(confirmOpen.id, confirmOpen.month)} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg">
                    Confirm Ready
                  </button>
                </div>
              </>
            )}
            {confirmOpen.type === 'sync' && (
              <>
                <h2 className="text-base font-semibold text-zinc-900 mb-2">Sync Xero Data</h2>
                <p className="text-sm text-zinc-600 mb-6">
                  This will pull P&L, balance sheet, AR days and AP days from Xero for{' '}
                  <strong>{fmtMonth(confirmOpen.month)}</strong> and save them to the ERP.
                </p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setConfirmOpen(null)} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">Cancel</button>
                  <button onClick={() => syncXero(confirmOpen.id, confirmOpen.month)} className="px-4 py-2 bg-brand hover:bg-brand/90 text-white text-sm font-medium rounded-lg">
                    Sync Now
                  </button>
                </div>
              </>
            )}
            {confirmOpen.type === 'lock' && (
              <>
                <h2 className="text-base font-semibold text-zinc-900 mb-2">Lock Month</h2>
                <p className="text-sm text-zinc-600 mb-6">
                  Locking <strong>{fmtMonth(confirmOpen.month)}</strong> will prevent any further data changes for this month.
                  This cannot be undone.
                </p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setConfirmOpen(null)} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">Cancel</button>
                  <button onClick={() => lockMonth(confirmOpen.id)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
                    Lock Month
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
