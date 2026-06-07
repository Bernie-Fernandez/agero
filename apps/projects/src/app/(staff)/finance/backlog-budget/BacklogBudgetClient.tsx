'use client';

import { useState, useTransition, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  upsertBacklogBudget,
  lockFYBacklog,
  adjustBacklogBudget,
  getProjectCATTrend,
  listBacklogBudget,
  type BacklogRow,
  type FYSettingsRow,
  type PageMode,
  type CATTrendRow,
} from './actions';
import type { BacklogClassification, BacklogBudgetStatus } from '@agero/db';

// ─── Formatting ───────────────────────────────────────────────────────────────

const AUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
const AUD2 = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 });
function fmtAUD(v: number | string) { return AUD.format(Number(v)); }
function fmtAUD2(v: number | string) { return AUD2.format(Number(v)); }
function fmtPct(v: number | string) { return (Number(v) * 100).toFixed(1) + '%'; }
function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function staleDays(iso: string | null): number {
  if (!iso) return 9999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

// ─── Mode Badge ───────────────────────────────────────────────────────────────

function ModeBadge({ mode }: { mode: PageMode }) {
  const map: Record<PageMode, { label: string; cls: string }> = {
    UPCOMING: { label: 'UPCOMING', cls: 'bg-zinc-100 text-zinc-600' },
    DRAFT: { label: 'DRAFT', cls: 'bg-blue-100 text-blue-700' },
    READY_TO_LOCK: { label: 'READY TO LOCK', cls: 'bg-amber-100 text-amber-700' },
    LOCKED: { label: 'LOCKED', cls: 'bg-emerald-100 text-emerald-700' },
  };
  const { label, cls } = map[mode];
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold tracking-wide ${cls}`}>{label}</span>;
}

function StatusBadge({ status }: { status: BacklogBudgetStatus }) {
  if (status === 'LOCKED') return <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700">LOCKED</span>;
  if (status === 'ADJUSTED') return <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">ADJUSTED</span>;
  return <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-zinc-100 text-zinc-500">DRAFT</span>;
}

// ─── CAT Context Panel ────────────────────────────────────────────────────────

function CATContextPanel({
  row,
  onClose,
  onPrefill,
}: {
  row: BacklogRow;
  onClose: () => void;
  onPrefill: (value: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [trend, setTrend] = useState<CATTrendRow[]>([]);
  const [keyFigures, setKeyFigures] = useState<{
    marginToEarn: string; nettRetention: string; nettCashFlow: string;
    billingLessCost: string; practicalCompletion: string | null; asAtDate: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useState(() => {
    getProjectCATTrend(row.financeProjectId).then((res) => {
      setLoading(false);
      if (res.ok) {
        setTrend(res.trend ?? []);
        setKeyFigures(res.keyFigures ?? null);
      } else {
        setError(res.error ?? 'Failed to load data.');
      }
    });
  });

  const isStale = keyFigures ? staleDays(keyFigures.asAtDate) > 45 : false;

  function marginColour(idx: number): string {
    if (trend.length < 2 || idx >= trend.length - 1) return '';
    const curr = Number(trend[idx].forecastMarginPct);
    const prev = Number(trend[idx + 1].forecastMarginPct);
    return curr > prev ? 'text-emerald-700 font-medium' : curr < prev ? 'text-red-600 font-medium' : '';
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white shadow-xl flex flex-col h-full overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <p className="text-xs text-zinc-500">{row.jobNumber}</p>
            <h3 className="font-semibold text-zinc-900 text-sm">{row.projectName}</h3>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 px-5 py-4 space-y-5">
          {loading && <p className="text-sm text-zinc-500">Loading CAT data…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {!loading && !error && (
            <>
              {isStale && keyFigures && (
                <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800">
                  CAT data last updated {fmtDate(keyFigures.asAtDate)} — figures may be stale. Run a CAT import to refresh.
                </div>
              )}

              <div>
                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Last 3 months — margin trend</h4>
                {trend.length === 0 ? (
                  <p className="text-sm text-zinc-400">No CAT snapshot data available for this project.</p>
                ) : (
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="text-left border-b text-zinc-500">
                        <th className="pb-1 pr-2">Month</th>
                        <th className="pb-1 pr-2 text-right">Forecast Contract</th>
                        <th className="pb-1 pr-2 text-right">Total Cost</th>
                        <th className="pb-1 pr-2 text-right">Margin %</th>
                        <th className="pb-1 text-right">R&O</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trend.map((t, i) => (
                        <tr key={t.asAtDate} className="border-b border-zinc-50">
                          <td className="py-1.5 pr-2 text-zinc-700">{fmtDate(t.asAtDate)}</td>
                          <td className="py-1.5 pr-2 text-right">{fmtAUD(t.forecastContract)}</td>
                          <td className="py-1.5 pr-2 text-right">{fmtAUD(t.totalCost)}</td>
                          <td className={`py-1.5 pr-2 text-right ${marginColour(i)}`}>{fmtPct(t.forecastMarginPct)}</td>
                          <td className="py-1.5 text-right">{fmtAUD(t.roAdjust)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {keyFigures && (
                <div>
                  <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Key figures (latest)</h4>
                  <div className="space-y-1.5">
                    {[
                      ['Margin to Earn', fmtAUD2(keyFigures.marginToEarn)],
                      ['Nett Retention', fmtAUD2(keyFigures.nettRetention)],
                      ['Nett Cash Flow', fmtAUD2(keyFigures.nettCashFlow)],
                      ['Billing Less Cost', fmtAUD2(keyFigures.billingLessCost)],
                      ['PC Date', keyFigures.practicalCompletion ? fmtDate(keyFigures.practicalCompletion) : 'Not set'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between text-sm">
                        <span className="text-zinc-500">{label}</span>
                        <span className="font-medium text-zinc-900">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {keyFigures && (
                <button
                  onClick={() => { onPrefill(keyFigures.nettRetention); onClose(); }}
                  className="w-full text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium py-2 px-3 rounded border border-blue-200 transition-colors"
                >
                  Use Nett Retention as Backlog Revenue ({fmtAUD2(keyFigures.nettRetention)})
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Lock Modal ───────────────────────────────────────────────────────────────

function LockModal({
  fyYear,
  awardedTotal,
  backlogTotal,
  awardedCount,
  backlogCount,
  onCancel,
  onConfirm,
  locking,
}: {
  fyYear: string;
  awardedTotal: number;
  backlogTotal: number;
  awardedCount: number;
  backlogCount: number;
  onCancel: () => void;
  onConfirm: () => void;
  locking: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-base font-semibold text-zinc-900 mb-3">Lock {fyYear} Backlog Budget</h2>
        <p className="text-sm text-zinc-600 mb-4">
          You are about to lock the {fyYear} Backlog budget. Once locked:
        </p>
        <ul className="text-sm text-zinc-600 space-y-1 mb-4 list-disc pl-4">
          <li>All figures are frozen</li>
          <li>Changes require a Director override with a reason</li>
          <li>This becomes the baseline for {fyYear} monthly reporting</li>
        </ul>
        <div className="bg-zinc-50 rounded p-3 text-sm space-y-1 mb-5">
          <div className="flex justify-between">
            <span className="text-zinc-600">{awardedCount} projects — Awarded</span>
            <span className="font-medium">{fmtAUD(awardedTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600">{backlogCount} projects — Backlog</span>
            <span className="font-medium">{fmtAUD(backlogTotal)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 mt-1">
            <span className="font-semibold text-zinc-900">Grand total</span>
            <span className="font-semibold">{fmtAUD(awardedTotal + backlogTotal)}</span>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-zinc-700 border border-zinc-300 rounded hover:bg-zinc-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={locking}
            className="px-4 py-2 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
          >
            {locking ? 'Locking…' : `Lock ${fyYear} Backlog`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Adjustment Form ──────────────────────────────────────────────────────────

function AdjustForm({
  row,
  onCancel,
  onSave,
}: {
  row: BacklogRow;
  onCancel: () => void;
  onSave: (classification: BacklogClassification, budgetRevenue: number, reason: string) => Promise<void>;
}) {
  const [classification, setClassification] = useState<BacklogClassification>(row.classification);
  const [budgetRevenue, setBudgetRevenue] = useState(row.budgetRevenue);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (reason.trim().length < 10) { setError('Reason must be at least 10 characters.'); return; }
    setSaving(true);
    setError(null);
    await onSave(classification, Number(budgetRevenue), reason);
    setSaving(false);
  }

  return (
    <tr>
      <td colSpan={9} className="px-3 py-3 bg-amber-50 border-b">
        <div className="flex flex-wrap gap-3 items-start">
          <div>
            <label className="text-xs text-zinc-600 block mb-1">New Classification</label>
            <select
              value={classification}
              onChange={(e) => setClassification(e.target.value as BacklogClassification)}
              className="text-sm border border-zinc-300 rounded px-2 py-1"
            >
              <option value="AWARDED">Awarded</option>
              <option value="BACKLOG">Backlog</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-600 block mb-1">New Budget Revenue ($)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={budgetRevenue}
              onChange={(e) => setBudgetRevenue(e.target.value)}
              className="text-sm border border-zinc-300 rounded px-2 py-1 w-36"
            />
          </div>
          <div className="flex-1 min-w-48">
            <label className="text-xs text-zinc-600 block mb-1">Reason for adjustment <span className="text-red-500">*</span></label>
            <input
              type="text"
              placeholder="Describe why this figure is being changed…"
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(null); }}
              className="text-sm border border-zinc-300 rounded px-2 py-1 w-full"
            />
            {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
          </div>
          <div className="flex gap-2 pt-5">
            <button onClick={onCancel} className="text-xs text-zinc-600 border border-zinc-300 rounded px-3 py-1.5 hover:bg-zinc-50">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs bg-orange-600 text-white rounded px-3 py-1.5 hover:bg-orange-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Adjustment'}
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── Editable Row ─────────────────────────────────────────────────────────────

function BacklogRow({
  row,
  isEditable,
  isDirector,
  onSave,
  onViewCAT,
  onAdjust,
  adjustingId,
  onAdjustSave,
  onAdjustCancel,
}: {
  row: BacklogRow;
  isEditable: boolean;
  isDirector: boolean;
  onSave: (id: string, field: 'classification' | 'budgetRevenue' | 'notes', value: string) => Promise<void>;
  onViewCAT: (row: BacklogRow) => void;
  onAdjust: (financeProjectId: string) => void;
  adjustingId: string | null;
  onAdjustSave: (row: BacklogRow, cls: BacklogClassification, rev: number, reason: string) => Promise<void>;
  onAdjustCancel: () => void;
}) {
  const [localClass, setLocalClass] = useState<BacklogClassification>(row.classification);
  const [localRevenue, setLocalRevenue] = useState(row.budgetRevenue);
  const [localNotes, setLocalNotes] = useState(row.notes ?? '');
  const [saved, setSaved] = useState(false);

  async function handleBlur(field: 'classification' | 'budgetRevenue' | 'notes', value: string) {
    await onSave(row.financeProjectId, field, value);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const isAdjusting = adjustingId === row.financeProjectId;
  const isLocked = row.status === 'LOCKED' || row.status === 'ADJUSTED';
  const canEdit = isEditable && !isLocked;

  return (
    <>
      <tr className="border-b hover:bg-zinc-50 text-sm">
        <td className="px-3 py-2 text-zinc-500 text-xs whitespace-nowrap">{row.jobNumber}</td>
        <td className="px-3 py-2 text-zinc-900">{row.projectName}</td>
        <td className="px-3 py-2">
          {canEdit ? (
            <select
              value={localClass}
              onChange={(e) => setLocalClass(e.target.value as BacklogClassification)}
              onBlur={(e) => handleBlur('classification', e.target.value)}
              className="text-sm border border-zinc-300 rounded px-1.5 py-0.5 bg-white"
            >
              <option value="AWARDED">Awarded</option>
              <option value="BACKLOG">Backlog</option>
            </select>
          ) : (
            <span className={localClass === 'BACKLOG' ? 'text-purple-700 font-medium' : 'text-zinc-700'}>{localClass === 'BACKLOG' ? 'Backlog' : 'Awarded'}</span>
          )}
        </td>
        <td className="px-3 py-2">
          {canEdit ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                step="1"
                value={localRevenue}
                onChange={(e) => setLocalRevenue(e.target.value)}
                onBlur={(e) => handleBlur('budgetRevenue', e.target.value)}
                className="text-sm border border-zinc-300 rounded px-1.5 py-0.5 w-28 text-right"
              />
              {saved && <span className="text-xs text-emerald-600">Saved ✓</span>}
            </div>
          ) : (
            fmtAUD(localRevenue)
          )}
        </td>
        <td className="px-3 py-2 text-right text-zinc-600 text-xs">
          {row.latestSnapshot ? fmtAUD(row.latestSnapshot.forecastContract) : '—'}
        </td>
        <td className="px-3 py-2 text-right text-zinc-600 text-xs">
          {row.latestSnapshot ? fmtAUD(row.latestSnapshot.marginToEarn) : '—'}
        </td>
        <td className="px-3 py-2 text-right text-zinc-600 text-xs">
          {row.latestSnapshot ? fmtAUD(row.latestSnapshot.nettRetention) : '—'}
        </td>
        <td className="px-3 py-2 text-xs">
          <StatusBadge status={row.status} />
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onViewCAT(row)}
              className="text-xs text-blue-600 hover:underline whitespace-nowrap"
            >
              CAT trend
            </button>
            {isLocked && isDirector && (
              <button
                onClick={() => onAdjust(row.financeProjectId)}
                className="text-xs text-orange-600 hover:underline"
              >
                Adjust
              </button>
            )}
          </div>
        </td>
      </tr>
      {isAdjusting && (
        <AdjustForm
          row={row}
          onCancel={onAdjustCancel}
          onSave={async (cls, rev, reason) => { await onAdjustSave(row, cls, rev, reason); }}
        />
      )}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BacklogBudgetClient({
  initialRows,
  fySettings,
  initialMode,
  currentFY,
  isDirector,
}: {
  initialRows: BacklogRow[];
  fySettings: FYSettingsRow;
  initialMode: PageMode;
  currentFY: string;
  isDirector: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<BacklogRow[]>(initialRows);
  const [mode, setMode] = useState<PageMode>(initialMode);
  const [selectedFY, setSelectedFY] = useState(currentFY);
  const [catPanelRow, setCatPanelRow] = useState<BacklogRow | null>(null);
  const [showLockModal, setShowLockModal] = useState(false);
  const [locking, startLock] = useTransition();
  const [lockError, setLockError] = useState<string | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const awardedRows = rows.filter((r) => r.classification === 'AWARDED');
  const backlogRows = rows.filter((r) => r.classification === 'BACKLOG');
  const awardedTotal = awardedRows.reduce((s, r) => s + Number(r.budgetRevenue), 0);
  const backlogTotal = backlogRows.reduce((s, r) => s + Number(r.budgetRevenue), 0);
  const grandTotal = awardedTotal + backlogTotal;

  const isEditable = mode === 'DRAFT' || mode === 'READY_TO_LOCK';
  const isLocked = mode === 'LOCKED';
  const lockedAt = isLocked ? rows.find((r) => r.status === 'LOCKED' || r.status === 'ADJUSTED')?.lockedAt : null;

  const FY_OPTIONS = [currentFY, `FY${Number(currentFY.slice(2)) - 1}`];

  async function handleFYChange(fy: string) {
    setSelectedFY(fy);
    startTransition(async () => {
      const res = await listBacklogBudget(fy);
      if (res.ok) setRows(res.rows ?? []);
    });
  }

  async function handleSave(financeProjectId: string, field: 'classification' | 'budgetRevenue' | 'notes', value: string) {
    const row = rows.find((r) => r.financeProjectId === financeProjectId);
    if (!row) return;
    const updated = {
      financeProjectId,
      fyYear: selectedFY,
      classification: field === 'classification' ? (value as BacklogClassification) : row.classification,
      budgetRevenue: field === 'budgetRevenue' ? Number(value) : Number(row.budgetRevenue),
      notes: field === 'notes' ? value : row.notes,
    };
    const res = await upsertBacklogBudget(updated);
    if (res.ok) {
      setRows((prev) => prev.map((r) =>
        r.financeProjectId === financeProjectId
          ? { ...r, ...updated, budgetRevenue: String(updated.budgetRevenue), id: res.id ?? r.id }
          : r
      ));
    }
  }

  function handleLockClick() {
    setShowLockModal(true);
    setLockError(null);
  }

  function handleLockConfirm() {
    startLock(async () => {
      const res = await lockFYBacklog(selectedFY);
      if (res.ok) {
        setShowLockModal(false);
        setMode('LOCKED');
        setRows((prev) => prev.map((r) => ({ ...r, status: 'LOCKED', lockedAt: new Date().toISOString() })));
      } else {
        setLockError(res.error ?? 'Lock failed.');
      }
    });
  }

  async function handleAdjustSave(row: BacklogRow, cls: BacklogClassification, rev: number, reason: string) {
    const res = await adjustBacklogBudget({
      financeProjectId: row.financeProjectId,
      fyYear: selectedFY,
      classification: cls,
      budgetRevenue: rev,
      adjustmentReason: reason,
    });
    if (res.ok) {
      setAdjustingId(null);
      setRows((prev) => prev.map((r) =>
        r.financeProjectId === row.financeProjectId
          ? { ...r, status: 'ADJUSTED', classification: cls, budgetRevenue: String(rev), lastAdjustedAt: new Date().toISOString(), adjustmentReason: reason }
          : r
      ));
    }
  }

  function handlePrefill(financeProjectId: string, value: string) {
    setRows((prev) => prev.map((r) =>
      r.financeProjectId === financeProjectId ? { ...r, budgetRevenue: value } : r
    ));
    handleSave(financeProjectId, 'budgetRevenue', value);
  }

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-semibold text-zinc-900">Backlog Budget — {selectedFY}</h1>
            <ModeBadge mode={mode} />
            {isLocked && lockedAt && (
              <span className="text-xs text-zinc-500">Locked {fmtDate(lockedAt)}</span>
            )}
          </div>
          <p className="text-sm text-zinc-500">Set and lock annual project classifications and budget revenue figures.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedFY}
            onChange={(e) => handleFYChange(e.target.value)}
            className="text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
          >
            {FY_OPTIONS.map((fy) => (
              <option key={fy} value={fy}>{fy}</option>
            ))}
          </select>
          {(mode === 'DRAFT' || mode === 'READY_TO_LOCK') && isDirector && (
            <button
              onClick={handleLockClick}
              className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-1.5 rounded transition-colors"
            >
              Lock {selectedFY} Backlog
            </button>
          )}
        </div>
      </div>

      {/* Mode banner for UPCOMING */}
      {mode === 'UPCOMING' && (
        <div className="bg-zinc-50 border border-zinc-200 rounded p-4 mb-5 text-sm text-zinc-600">
          Backlog budget for {currentFY} opens on {fySettings.draftOpenDay}/{fySettings.draftOpenMonth}. View prior year records above.
        </div>
      )}

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Awarded Budget', value: fmtAUD(awardedTotal), sub: `${awardedRows.length} projects` },
          { label: 'Backlog Budget', value: fmtAUD(backlogTotal), sub: `${backlogRows.length} projects` },
          { label: 'Grand Total', value: fmtAUD(grandTotal), sub: `${rows.length} projects` },
          { label: 'Status', value: rows.filter((r) => r.status !== 'DRAFT').length > 0 ? `${rows.filter((r) => r.status === 'LOCKED').length} locked, ${rows.filter((r) => r.status === 'ADJUSTED').length} adjusted` : 'All draft', sub: '' },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-zinc-200 rounded p-3">
            <p className="text-xs text-zinc-500 mb-0.5">{c.label}</p>
            <p className="text-base font-semibold text-zinc-900">{c.value}</p>
            {c.sub && <p className="text-xs text-zinc-400">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Main table */}
      <div className="bg-white border border-zinc-200 rounded overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="border-b bg-zinc-50">
            <tr className="text-left text-xs text-zinc-500">
              <th className="px-3 py-2">Job No</th>
              <th className="px-3 py-2">Project Name</th>
              <th className="px-3 py-2">Classification</th>
              <th className="px-3 py-2 text-right">Budget Revenue</th>
              <th className="px-3 py-2 text-right">CAT Forecast</th>
              <th className="px-3 py-2 text-right">Margin to Earn</th>
              <th className="px-3 py-2 text-right">Nett Retention</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-sm text-zinc-400">
                  No active projects found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <BacklogRow
                  key={row.financeProjectId}
                  row={row}
                  isEditable={isEditable}
                  isDirector={isDirector}
                  onSave={handleSave}
                  onViewCAT={(r) => setCatPanelRow(r)}
                  onAdjust={(id) => setAdjustingId(id)}
                  adjustingId={adjustingId}
                  onAdjustSave={handleAdjustSave}
                  onAdjustCancel={() => setAdjustingId(null)}
                />
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t bg-zinc-50">
              <tr className="text-sm font-semibold">
                <td colSpan={3} className="px-3 py-2 text-zinc-700">Totals</td>
                <td className="px-3 py-2 text-right">{fmtAUD(grandTotal)}</td>
                <td colSpan={5} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {lockError && (
        <p className="mt-3 text-sm text-red-600">{lockError}</p>
      )}

      {/* Modals & panels */}
      {showLockModal && (
        <LockModal
          fyYear={selectedFY}
          awardedTotal={awardedTotal}
          backlogTotal={backlogTotal}
          awardedCount={awardedRows.length}
          backlogCount={backlogRows.length}
          onCancel={() => setShowLockModal(false)}
          onConfirm={handleLockConfirm}
          locking={locking}
        />
      )}

      {catPanelRow && (
        <CATContextPanel
          row={catPanelRow}
          onClose={() => setCatPanelRow(null)}
          onPrefill={(value) => { handlePrefill(catPanelRow.financeProjectId, value); }}
        />
      )}
    </div>
  );
}
