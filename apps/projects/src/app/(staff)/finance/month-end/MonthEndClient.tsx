'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  markReady,
  calculateWip,
  resyncXero,
  lockMonth,
  type MonthEndRow,
} from '@/lib/month-end/actions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMonth(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function fmtAUD(v: string | null) {
  if (v == null) return '—';
  const n = Number(v);
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  OPEN:           'bg-zinc-100 text-zinc-600',
  READY:          'bg-blue-100 text-blue-700',
  SYNCED:         'bg-green-100 text-green-700',
  WIP_CALCULATED: 'bg-amber-100 text-amber-700',
  WIP_REVIEWED:   'bg-amber-100 text-amber-700',
  JOURNAL_POSTED: 'bg-emerald-100 text-emerald-700',
  XERO_RESYNCED:  'bg-emerald-100 text-emerald-700',
  LOCKED:         'bg-green-700 text-white',
};

const STATUS_LABELS: Record<string, string> = {
  OPEN:           'Open',
  READY:          'Ready',
  SYNCED:         'Synced',
  WIP_CALCULATED: 'WIP Calculated',
  WIP_REVIEWED:   'WIP Reviewed',
  JOURNAL_POSTED: 'Journal Posted',
  XERO_RESYNCED:  'Xero Re-synced',
  LOCKED:         '🔒 Locked',
};

// ─── Confirmation dialog ──────────────────────────────────────────────────────

type ConfirmPayload =
  | { type: 'ready'; row: MonthEndRow }
  | { type: 'calculate'; row: MonthEndRow }
  | { type: 'resync'; row: MonthEndRow }
  | { type: 'lock'; row: MonthEndRow };

function ConfirmDialog({
  payload,
  onCancel,
  onConfirm,
  pending,
}: {
  payload: ConfirmPayload;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  const monthLabel = fmtMonth(payload.row.reportMonth);

  let title = '';
  let body: React.ReactNode = null;
  let confirmLabel = 'Confirm';
  let confirmStyle = 'bg-blue-600 hover:bg-blue-700 text-white';

  if (payload.type === 'ready') {
    title = `Mark ${monthLabel} as Ready?`;
    body = (
      <ul className="text-sm text-zinc-600 space-y-1 list-disc list-inside">
        <li>All job cost reports are in</li>
        <li>CAT Cloud has been updated by PMs</li>
        <li>Journals are complete in Xero</li>
      </ul>
    );
    confirmLabel = 'Mark as Ready';
    confirmStyle = 'bg-amber-500 hover:bg-amber-600 text-white';
  } else if (payload.type === 'calculate') {
    title = `Calculate WIP for ${monthLabel}?`;
    body = (
      <p className="text-sm text-zinc-600">
        This will read the latest CAT snapshot data and calculate per-project WIP and net movement.
        You can re-run this if new CAT data is imported.
      </p>
    );
    confirmLabel = 'Calculate WIP';
    confirmStyle = 'bg-amber-500 hover:bg-amber-600 text-white';
  } else if (payload.type === 'resync') {
    title = `Re-sync Xero P&L for ${monthLabel}?`;
    body = (
      <p className="text-sm text-zinc-600">
        This will pull the updated Xero P&L for {monthLabel} (which now includes the WIP journal adjustment)
        and overwrite the existing Xero P&L snapshot for this month.
      </p>
    );
    confirmLabel = 'Re-sync Xero';
    confirmStyle = 'bg-blue-600 hover:bg-blue-700 text-white';
  } else if (payload.type === 'lock') {
    title = `Lock ${monthLabel}?`;
    body = (
      <ul className="text-sm text-zinc-600 space-y-1 list-disc list-inside">
        <li>All financial data for this month will be frozen</li>
        <li>CAT snapshots, Xero P&L, and WIP lines cannot be changed</li>
        <li>This cannot be undone</li>
      </ul>
    );
    confirmLabel = 'Lock Month';
    confirmStyle = 'bg-red-600 hover:bg-red-700 text-white';
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-zinc-900 mb-3">{title}</h2>
        <div className="mb-6">{body}</div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={pending}
            className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={pending}
            className={`px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 ${confirmStyle}`}
          >
            {pending ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MonthEndClient({
  initialRows,
  error,
}: {
  initialRows: MonthEndRow[];
  error?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [confirm, setConfirm] = useState<ConfirmPayload | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function refresh() {
    router.refresh();
  }

  function updateRow(id: string, patch: Partial<MonthEndRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function handleConfirm() {
    if (!confirm) return;
    setActionError(null);

    startTransition(async () => {
      let result: { ok: boolean; error?: string } = { ok: false };

      if (confirm.type === 'ready') {
        result = await markReady(confirm.row.id);
        if (result.ok) updateRow(confirm.row.id, { status: 'READY', markedReadyAt: new Date().toISOString() });
      } else if (confirm.type === 'calculate') {
        result = await calculateWip(confirm.row.id);
        if (result.ok) updateRow(confirm.row.id, { status: 'WIP_CALCULATED', wipCalculatedAt: new Date().toISOString() });
      } else if (confirm.type === 'resync') {
        result = await resyncXero(confirm.row.id);
        if (result.ok) updateRow(confirm.row.id, { status: 'XERO_RESYNCED', xeroResyncedAt: new Date().toISOString() });
      } else if (confirm.type === 'lock') {
        result = await lockMonth({ monthEndId: confirm.row.id });
        if (result.ok) updateRow(confirm.row.id, { status: 'LOCKED', lockedAt: new Date().toISOString() });
      }

      if (!result.ok) setActionError(result.error ?? 'An error occurred.');
      setConfirm(null);
      refresh();
    });
  }

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>;
  }

  return (
    <>
      {actionError && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
          {actionError}
        </div>
      )}

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Month</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">CAT Imported</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">WIP Movement</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Journal</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-medium text-zinc-900">{fmtMonth(row.reportMonth)}</td>
                <td className="px-4 py-3 text-zinc-500 text-xs">
                  {row.catImportDate ? (
                    <span className="flex items-center gap-1">
                      {fmtDate(row.catImportDate)}
                      {row.catStale && (
                        <span
                          className="text-amber-500"
                          title="CAT data may be from a different period — import a current snapshot before locking."
                        >
                          ⚠
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-zinc-300">No import</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[row.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                    {STATUS_LABELS[row.status] ?? row.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-xs">
                  {row.wipNetMovement != null ? (
                    <span className={Number(row.wipNetMovement) >= 0 ? 'text-green-700' : 'text-red-600'}>
                      {fmtAUD(row.wipNetMovement)}
                    </span>
                  ) : (
                    <span className="text-zinc-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {row.xeroJournalId ? (
                    <span className="text-emerald-700">Posted</span>
                  ) : (
                    <span className="text-zinc-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {row.status === 'OPEN' && (
                      <button
                        onClick={() => setConfirm({ type: 'ready', row })}
                        className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-md"
                      >
                        Mark Ready
                      </button>
                    )}
                    {row.status === 'READY' && (
                      <button
                        onClick={() => setConfirm({ type: 'calculate', row })}
                        className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-md"
                      >
                        Calculate WIP
                      </button>
                    )}
                    {(row.status === 'WIP_CALCULATED' || row.status === 'WIP_REVIEWED') && (
                      <a
                        href={`/finance/month-end/${row.reportMonth.slice(0, 7)}`}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md"
                      >
                        Review WIP
                      </a>
                    )}
                    {row.status === 'JOURNAL_POSTED' && (
                      <button
                        onClick={() => setConfirm({ type: 'resync', row })}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md"
                      >
                        Re-sync Xero
                      </button>
                    )}
                    {row.status === 'XERO_RESYNCED' && (
                      <button
                        onClick={() => setConfirm({ type: 'lock', row })}
                        className="px-3 py-1 bg-zinc-800 hover:bg-zinc-900 text-white text-xs font-medium rounded-md"
                      >
                        Lock Month
                      </button>
                    )}
                    {row.status === 'LOCKED' && (
                      <span className="text-xs text-zinc-400">Locked {fmtDate(row.lockedAt)}</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirm && (
        <ConfirmDialog
          payload={confirm}
          onCancel={() => setConfirm(null)}
          onConfirm={handleConfirm}
          pending={isPending}
        />
      )}
    </>
  );
}
