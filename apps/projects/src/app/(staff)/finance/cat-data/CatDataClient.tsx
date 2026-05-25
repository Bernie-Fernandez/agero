'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────────────────────────

type Snapshot = {
  id: string;
  jobNo: string;
  projectName: string;
  status: string;
  practicalCompletion: string | null;
  forecastContract: number;
  forecastFinalCosts: number;
  forecastMargin: number;
  roAdjust: number;
  marginInclRo: number;
  forecastMarginPct: number;
  claimTotal: number;
  claimRetention: number;
  subClaims: number;
  subRetention: number;
  creditors: number;
  labour: number;
  plant: number;
  stock: number;
  totalCost: number;
  billingLessCost: number;
  marginToEarn: number;
  marginRealised: number;
  wip: number;
  overClaim: number;
  nettRetention: number;
  nettCashFlow: number;
  importedBy: { firstName: string; lastName: string };
  importedAt: string;
  sourceFilename: string | null;
};

type ImportRecord = {
  id: string;
  asAtDate: string;
  uploadedAt: string;
  sourceFilename: string;
  rowsTotal: number;
  rowsInserted: number;
  rowsUpdated: number;
  rowsSkipped: number;
  status: string;
  isOverwrite: boolean;
  uploadedBy: { firstName: string; lastName: string };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | string | undefined | null): string {
  const num = Number(n ?? 0);
  return num.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
}

function fmtPct(n: number | string | undefined | null): string {
  return `${(Number(n ?? 0) * 100).toFixed(1)}%`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

function monthLabel(iso: string): string {
  const [y, m] = iso.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ snap, onClose }: { snap: Snapshot; onClose: () => void }) {
  const fields: [string, string][] = [
    ['Status', snap.status],
    ['Job No', snap.jobNo],
    ['Project', snap.projectName],
    ['Pract. Completion', fmtDate(snap.practicalCompletion)],
    ['Forecast Contract', fmt(snap.forecastContract)],
    ['Forecast Final Costs', fmt(snap.forecastFinalCosts)],
    ['Forecast Margin', fmt(snap.forecastMargin)],
    ['R&O Adjust', fmt(snap.roAdjust)],
    ['Margin Incl. R&O', fmt(snap.marginInclRo)],
    ['Forecast Margin %', fmtPct(snap.forecastMarginPct)],
    ['Claim Total', fmt(snap.claimTotal)],
    ['Claim Retention', fmt(snap.claimRetention)],
    ['Sub Claims', fmt(snap.subClaims)],
    ['Sub Retention', fmt(snap.subRetention)],
    ['Creditors', fmt(snap.creditors)],
    ['Labour', fmt(snap.labour)],
    ['Plant', fmt(snap.plant)],
    ['Stock', fmt(snap.stock)],
    ['Total Cost', fmt(snap.totalCost)],
    ['Billing Less Cost', fmt(snap.billingLessCost)],
    ['Margin to Earn', fmt(snap.marginToEarn)],
    ['Margin Realised', fmt(snap.marginRealised)],
    ['WIP', fmt(snap.wip)],
    ['Over Claim', fmt(snap.overClaim)],
    ['Nett Retention', fmt(snap.nettRetention)],
    ['Nett Cash Flow', fmt(snap.nettCashFlow)],
    ['Imported by', `${snap.importedBy.firstName} ${snap.importedBy.lastName}`],
    ['Source file', snap.sourceFilename ?? '—'],
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md shadow-2xl overflow-y-auto">
        <div className="p-5 border-b border-zinc-200 flex items-start justify-between">
          <div>
            <p className="font-semibold text-zinc-900">{snap.projectName}</p>
            <p className="text-xs text-zinc-500 mt-0.5">Job {snap.jobNo} · {snap.status}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-lg leading-none mt-0.5">✕</button>
        </div>
        <div className="p-5">
          <dl className="space-y-2">
            {fields.map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <dt className="text-zinc-500 shrink-0 w-44">{label}</dt>
                <dd className="text-zinc-900 font-medium text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}

// ── Import history modal ──────────────────────────────────────────────────────

function ImportHistoryModal({ history, onClose }: { history: ImportRecord[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-5 border-b border-zinc-200 flex items-center justify-between">
          <h2 className="font-semibold text-zinc-900">Import History</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700">✕</button>
        </div>
        <div className="overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">As-at</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">File</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">By</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Rows</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {history.map((imp) => (
                <tr key={imp.id} className="hover:bg-zinc-50/50">
                  <td className="px-4 py-3 font-medium text-zinc-900">{fmtDate(imp.asAtDate)}</td>
                  <td className="px-4 py-3 text-zinc-500 max-w-xs truncate">{imp.sourceFilename}</td>
                  <td className="px-4 py-3 text-zinc-600">{imp.uploadedBy.firstName} {imp.uploadedBy.lastName}</td>
                  <td className="px-4 py-3 text-right text-zinc-700">{imp.rowsTotal}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      imp.isOverwrite ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {imp.isOverwrite ? 'Overwrite' : 'New'}
                    </span>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-400 text-sm">No imports yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CatDataClient({
  months,
  selectedMonth,
  snapshots,
  importHistory,
}: {
  months: string[];
  selectedMonth: string | null;
  snapshots: Snapshot[];
  importHistory: ImportRecord[];
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<'All' | 'Awarded' | 'Backlog'>('All');
  const [projectFilter, setProjectFilter] = useState('');
  const [detailSnap, setDetailSnap] = useState<Snapshot | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [sortCol, setSortCol] = useState<keyof Snapshot>('forecastContract');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filtered = useMemo(() => {
    return snapshots.filter((s) => {
      if (statusFilter !== 'All' && s.status !== statusFilter) return false;
      if (projectFilter && !s.projectName.toLowerCase().includes(projectFilter.toLowerCase()) && !s.jobNo.includes(projectFilter)) return false;
      return true;
    });
  }, [snapshots, statusFilter, projectFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortCol] as string | number;
      const bv = b[sortCol] as string | number;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [filtered, sortCol, sortDir]);

  function handleSort(col: keyof Snapshot) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('asc'); }
  }

  // Totals
  const awarded = sorted.filter((s) => s.status === 'Awarded');
  const backlog = sorted.filter((s) => s.status === 'Backlog');

  function sum(rows: Snapshot[], field: keyof Snapshot): number {
    return rows.reduce((acc, r) => acc + Number(r[field] ?? 0), 0);
  }

  // CSV export
  function handleExport() {
    const headers = ['Status', 'Job No', 'Project Name', 'Pract Comp', 'Forecast Contract', 'Forecast Final Costs', 'Forecast Margin', 'R&O Adjust', 'Margin Incl R&O', 'Forecast Margin %', 'Claim Total', 'Claim Retention', 'Sub Claims', 'Sub Retention', 'Creditors', 'Labour', 'Plant', 'Stock', 'Total Cost', 'Billing Less Cost', 'Margin to Earn', 'Margin Realised', 'WIP', 'Over Claim', 'Nett Retention', 'Nett Cash Flow'];
    const rows = sorted.map((s) => [
      s.status, s.jobNo, s.projectName, fmtDate(s.practicalCompletion),
      s.forecastContract, s.forecastFinalCosts, s.forecastMargin, s.roAdjust,
      s.marginInclRo, (Number(s.forecastMarginPct) * 100).toFixed(2) + '%',
      s.claimTotal, s.claimRetention, s.subClaims, s.subRetention,
      s.creditors, s.labour, s.plant, s.stock, s.totalCost,
      s.billingLessCost, s.marginToEarn, s.marginRealised, s.wip,
      s.overClaim, s.nettRetention, s.nettCashFlow,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cat-data-${selectedMonth ?? 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const SortIcon = ({ col }: { col: keyof Snapshot }) =>
    sortCol !== col ? null : (
      <span className="ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>
    );

  if (months.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 p-10 text-center">
        <p className="text-zinc-500 text-sm">No CAT data imported yet.</p>
        <a href="/finance/cat-import" className="mt-3 inline-block text-sm text-brand font-medium hover:underline">
          Import your first CAT export →
        </a>
      </div>
    );
  }

  return (
    <>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={selectedMonth ?? ''}
          onChange={(e) => router.push(`/finance/cat-data?asAt=${e.target.value}`)}
          className="px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
        >
          {months.map((m) => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Awarded' | 'Backlog')}
          className="px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
        >
          <option value="All">All statuses</option>
          <option value="Awarded">Awarded</option>
          <option value="Backlog">Backlog</option>
        </select>

        <input
          type="text"
          placeholder="Filter by project or job no…"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 w-56"
        />

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setShowHistory(true)}
            className="px-3 py-2 text-sm border border-zinc-200 rounded-lg hover:bg-zinc-50"
          >
            Import history
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-2 text-sm border border-zinc-200 rounded-lg hover:bg-zinc-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-zinc-200 rounded-xl overflow-auto">
        <table className="w-full text-xs min-w-[1400px]">
          <thead className="bg-zinc-50 border-b border-zinc-200 sticky top-0">
            <tr>
              {[
                ['status', 'Status'],
                ['jobNo', 'Job No'],
                ['projectName', 'Project'],
                ['forecastContract', 'Contract'],
                ['forecastFinalCosts', 'Final Costs'],
                ['forecastMargin', 'Margin'],
                ['forecastMarginPct', 'Margin %'],
                ['claimTotal', 'Claim Total'],
                ['totalCost', 'Total Cost'],
                ['billingLessCost', 'Billing–Cost'],
                ['marginToEarn', 'Marg to Earn'],
                ['marginRealised', 'Marg Realised'],
                ['wip', 'WIP'],
                ['overClaim', 'Over Claim'],
                ['nettRetention', 'Nett Ret.'],
                ['nettCashFlow', 'Nett CF'],
              ].map(([col, label]) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left font-medium text-zinc-500 cursor-pointer hover:text-zinc-700 whitespace-nowrap"
                  onClick={() => handleSort(col as keyof Snapshot)}
                >
                  {label}<SortIcon col={col as keyof Snapshot} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {sorted.map((snap) => (
              <tr
                key={snap.id}
                className="hover:bg-zinc-50/70 cursor-pointer"
                onClick={() => setDetailSnap(snap)}
              >
                <td className="px-3 py-2">
                  <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${snap.status === 'Awarded' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {snap.status}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-zinc-700">{snap.jobNo}</td>
                <td className="px-3 py-2 text-zinc-700 max-w-[200px] truncate">{snap.projectName}</td>
                <td className="px-3 py-2 text-right text-zinc-700">{fmt(snap.forecastContract)}</td>
                <td className="px-3 py-2 text-right text-zinc-700">{fmt(snap.forecastFinalCosts)}</td>
                <td className="px-3 py-2 text-right text-zinc-700">{fmt(snap.forecastMargin)}</td>
                <td className="px-3 py-2 text-right text-zinc-700">{fmtPct(snap.forecastMarginPct)}</td>
                <td className="px-3 py-2 text-right text-zinc-700">{fmt(snap.claimTotal)}</td>
                <td className="px-3 py-2 text-right text-zinc-700">{fmt(snap.totalCost)}</td>
                <td className="px-3 py-2 text-right text-zinc-700">{fmt(snap.billingLessCost)}</td>
                <td className="px-3 py-2 text-right text-zinc-700">{fmt(snap.marginToEarn)}</td>
                <td className="px-3 py-2 text-right text-zinc-700">{fmt(snap.marginRealised)}</td>
                <td className="px-3 py-2 text-right text-zinc-700">{fmt(snap.wip)}</td>
                <td className="px-3 py-2 text-right text-zinc-700">{fmt(snap.overClaim)}</td>
                <td className="px-3 py-2 text-right text-zinc-700">{fmt(snap.nettRetention)}</td>
                <td className="px-3 py-2 text-right text-zinc-700">{fmt(snap.nettCashFlow)}</td>
              </tr>
            ))}

            {/* Awarded subtotal */}
            {statusFilter === 'All' && awarded.length > 0 && (
              <tr className="bg-green-50 border-t border-green-200 font-semibold text-green-800">
                <td className="px-3 py-2 text-xs" colSpan={3}>Awarded Total ({awarded.length})</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(awarded, 'forecastContract'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(awarded, 'forecastFinalCosts'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(awarded, 'forecastMargin'))}</td>
                <td className="px-3 py-2 text-right text-xs">—</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(awarded, 'claimTotal'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(awarded, 'totalCost'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(awarded, 'billingLessCost'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(awarded, 'marginToEarn'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(awarded, 'marginRealised'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(awarded, 'wip'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(awarded, 'overClaim'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(awarded, 'nettRetention'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(awarded, 'nettCashFlow'))}</td>
              </tr>
            )}

            {/* Backlog subtotal */}
            {statusFilter === 'All' && backlog.length > 0 && (
              <tr className="bg-blue-50 border-t border-blue-200 font-semibold text-blue-800">
                <td className="px-3 py-2 text-xs" colSpan={3}>Backlog Total ({backlog.length})</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(backlog, 'forecastContract'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(backlog, 'forecastFinalCosts'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(backlog, 'forecastMargin'))}</td>
                <td className="px-3 py-2 text-right text-xs">—</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(backlog, 'claimTotal'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(backlog, 'totalCost'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(backlog, 'billingLessCost'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(backlog, 'marginToEarn'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(backlog, 'marginRealised'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(backlog, 'wip'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(backlog, 'overClaim'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(backlog, 'nettRetention'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(backlog, 'nettCashFlow'))}</td>
              </tr>
            )}

            {/* Grand total */}
            {sorted.length > 0 && (
              <tr className="bg-zinc-100 border-t-2 border-zinc-300 font-bold text-zinc-900">
                <td className="px-3 py-2 text-xs" colSpan={3}>Grand Total ({sorted.length})</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(sorted, 'forecastContract'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(sorted, 'forecastFinalCosts'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(sorted, 'forecastMargin'))}</td>
                <td className="px-3 py-2 text-right text-xs">—</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(sorted, 'claimTotal'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(sorted, 'totalCost'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(sorted, 'billingLessCost'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(sorted, 'marginToEarn'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(sorted, 'marginRealised'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(sorted, 'wip'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(sorted, 'overClaim'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(sorted, 'nettRetention'))}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(sum(sorted, 'nettCashFlow'))}</td>
              </tr>
            )}

            {sorted.length === 0 && (
              <tr>
                <td colSpan={16} className="px-4 py-8 text-center text-zinc-400 text-sm">
                  No snapshots for this month / filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detailSnap && <DetailPanel snap={detailSnap} onClose={() => setDetailSnap(null)} />}
      {showHistory && <ImportHistoryModal history={importHistory} onClose={() => setShowHistory(false)} />}
    </>
  );
}
