'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { CVRProjectRow } from '@/lib/cvr/actions';

// ─── Formatting ───────────────────────────────────────────────────────────────

const AUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
const fmt = (v: number) => AUD.format(v);
const pct = (v: number) => (v * 100).toFixed(1) + '%';

// ─── Health badge ─────────────────────────────────────────────────────────────

function HealthBadge({ health }: { health: CVRProjectRow['health'] }) {
  const map = {
    GREEN: { label: '✅', cls: 'bg-emerald-100 text-emerald-800' },
    AMBER: { label: '⚠', cls: 'bg-amber-100 text-amber-800' },
    RED: { label: '🔴', cls: 'bg-red-100 text-red-800' },
    GREY: { label: '—', cls: 'bg-zinc-100 text-zinc-500' },
  };
  const { label, cls } = map[health];
  return <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cls}`}>{label}</span>;
}

// ─── Sort types ───────────────────────────────────────────────────────────────

type SortKey = keyof CVRProjectRow;
type SortDir = 'asc' | 'desc';

// ─── Main component ───────────────────────────────────────────────────────────

export default function CVRClient({
  rows,
  latestMonth,
}: {
  rows: CVRProjectRow[];
  latestMonth: string | null;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('jobNo');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [classFilter, setClassFilter] = useState<'All' | 'AWARDED' | 'BACKLOG'>('All');
  const [healthFilter, setHealthFilter] = useState<'All' | 'AMBER' | 'RED'>('All');
  const [exporting, setExporting] = useState(false);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  const filtered = useMemo(() => {
    let out = [...rows];
    if (classFilter !== 'All') out = out.filter((r) => r.classification === classFilter);
    if (healthFilter !== 'All') out = out.filter((r) => r.health === healthFilter || (healthFilter === 'AMBER' && (r.health === 'AMBER' || r.health === 'RED')));
    out.sort((a, b) => {
      const av = a[sortKey] as string | number | null;
      const bv = b[sortKey] as string | number | null;
      const cmp = (av ?? '') < (bv ?? '') ? -1 : (av ?? '') > (bv ?? '') ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return out;
  }, [rows, sortKey, sortDir, classFilter, healthFilter]);

  // Summary card calculations
  const nonGrey = rows.filter((r) => r.health !== 'GREY');
  const totalForecastContract = rows.reduce((s, r) => s + r.forecastContract, 0);
  const weightedMarginSum = nonGrey.reduce((s, r) => s + r.forecastMarginPct * r.forecastContract, 0);
  const blendedMargin = totalForecastContract > 0 ? weightedMarginSum / totalForecastContract : 0;
  const totalWip = rows.reduce((s, r) => s + r.wip, 0);
  const atRiskCount = rows.filter((r) => r.health === 'RED' || r.health === 'AMBER').length;

  async function handleExport() {
    setExporting(true);
    try {
      const { exportCVRCSV } = await import('@/lib/cvr/actions');
      const res = await exportCVRCSV();
      if (!res.ok || !res.csv) return;
      const blob = new Blob([res.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cvr-${latestMonth ?? 'export'}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function SortHeader({ label, k }: { label: string; k: SortKey }) {
    const active = sortKey === k;
    return (
      <th
        onClick={() => handleSort(k)}
        className="px-2 py-2 text-right text-[11px] font-medium text-zinc-500 cursor-pointer hover:text-zinc-800 select-none whitespace-nowrap"
      >
        {label}{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      </th>
    );
  }

  const monthLabel = latestMonth
    ? new Date(latestMonth + 'T00:00:00').toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
    : 'No data';

  return (
    <div className="p-6 space-y-5 max-w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">CVR — Cost Value Reconciliation</h1>
          <p className="text-sm text-zinc-500 mt-0.5">As at: {monthLabel}</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-4 py-2 text-sm bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50"
        >
          {exporting ? 'Exporting…' : '↓ Export CSV'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Forecast Contract', value: fmt(totalForecastContract) },
          { label: 'Blended Forecast Margin', value: pct(blendedMargin), highlight: blendedMargin < 0.10 },
          { label: 'Total WIP Position', value: fmt(totalWip) },
          { label: 'Projects at Risk', value: `${atRiskCount}`, highlight: atRiskCount > 0 },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-zinc-200 rounded-xl px-4 py-4">
            <p className="text-xs text-zinc-500 mb-1">{c.label}</p>
            <p className={`text-xl font-bold ${c.highlight ? 'text-red-600' : 'text-zinc-900'}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium text-zinc-500">Filter:</span>
        <div className="flex rounded-lg overflow-hidden border border-zinc-300">
          {(['All', 'AWARDED', 'BACKLOG'] as const).map((v) => (
            <button key={v} onClick={() => setClassFilter(v)}
              className={`px-3 py-1.5 text-xs font-medium ${classFilter === v ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'} ${v !== 'All' ? 'border-l border-zinc-300' : ''}`}>
              {v === 'All' ? 'All' : v.charAt(0) + v.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg overflow-hidden border border-zinc-300">
          {([['All', 'All'], ['AMBER', 'At Risk'], ['RED', 'Red Only']] as const).map(([v, lbl]) => (
            <button key={v} onClick={() => setHealthFilter(v as 'All' | 'AMBER' | 'RED')}
              className={`px-3 py-1.5 text-xs font-medium ${healthFilter === v ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'} ${v !== 'All' ? 'border-l border-zinc-300' : ''}`}>
              {lbl}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-400">{filtered.length} project{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-zinc-200 rounded-xl bg-white">
        <table className="text-sm border-collapse" style={{ minWidth: '1100px' }}>
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th onClick={() => handleSort('jobNo')} className="px-3 py-2 text-left text-[11px] font-medium text-zinc-500 cursor-pointer hover:text-zinc-800 select-none whitespace-nowrap">
                Job No{sortKey === 'jobNo' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
              </th>
              <th onClick={() => handleSort('projectName')} className="px-3 py-2 text-left text-[11px] font-medium text-zinc-500 cursor-pointer hover:text-zinc-800 select-none">
                Project Name{sortKey === 'projectName' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
              </th>
              <th className="px-2 py-2 text-left text-[11px] font-medium text-zinc-500 whitespace-nowrap">Class</th>
              <SortHeader label="Contract" k="forecastContract" />
              <SortHeader label="Margin %" k="forecastMarginPct" />
              <SortHeader label="Margin to Earn" k="marginToEarn" />
              <SortHeader label="Billing-Cost" k="billingLessCost" />
              <SortHeader label="Margin Realised" k="marginRealised" />
              <SortHeader label="Over Claim" k="overClaim" />
              <SortHeader label="Nett Retention" k="nettRetention" />
              <SortHeader label="Nett Cash Flow" k="nettCashFlow" />
              <SortHeader label="WIP" k="wip" />
              <th className="px-2 py-2 text-center text-[11px] font-medium text-zinc-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-sm text-zinc-400">No projects match the selected filters.</td>
              </tr>
            )}
            {filtered.map((row) => (
              <tr key={row.projectId} className="border-b border-zinc-100 hover:bg-zinc-50">
                <td className="px-3 py-2 text-xs font-mono font-medium text-blue-700">
                  <Link href={`/finance/cvr/${row.projectId}`} className="hover:underline">{row.jobNo}</Link>
                </td>
                <td className="px-3 py-2 text-xs text-zinc-800 max-w-xs truncate">
                  <Link href={`/finance/cvr/${row.projectId}`} className="hover:underline">{row.projectName}</Link>
                </td>
                <td className="px-2 py-2 text-xs">
                  {row.classification ? (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${row.classification === 'AWARDED' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {row.classification.charAt(0) + row.classification.slice(1).toLowerCase()}
                    </span>
                  ) : '—'}
                </td>
                <td className={`px-2 py-2 text-right text-xs font-mono ${row.health === 'GREY' ? 'text-zinc-300' : 'text-zinc-800'}`}>{row.health !== 'GREY' ? fmt(row.forecastContract) : '—'}</td>
                <td className={`px-2 py-2 text-right text-xs font-mono ${row.health === 'GREY' ? 'text-zinc-300' : row.forecastMarginPct < 0.10 ? 'text-red-600 font-semibold' : 'text-zinc-800'}`}>
                  {row.health !== 'GREY' ? pct(row.forecastMarginPct) : '—'}
                </td>
                <td className={`px-2 py-2 text-right text-xs font-mono ${row.marginToEarn < 0 ? 'text-red-600 font-semibold' : 'text-zinc-800'}`}>{row.health !== 'GREY' ? fmt(row.marginToEarn) : '—'}</td>
                <td className="px-2 py-2 text-right text-xs font-mono text-zinc-800">{row.health !== 'GREY' ? fmt(row.billingLessCost) : '—'}</td>
                <td className="px-2 py-2 text-right text-xs font-mono text-zinc-800">{row.health !== 'GREY' ? fmt(row.marginRealised) : '—'}</td>
                <td className={`px-2 py-2 text-right text-xs font-mono ${row.overClaim < 0 ? 'text-red-600' : 'text-zinc-800'}`}>{row.health !== 'GREY' ? fmt(row.overClaim) : '—'}</td>
                <td className="px-2 py-2 text-right text-xs font-mono text-zinc-800">{row.health !== 'GREY' ? fmt(row.nettRetention) : '—'}</td>
                <td className={`px-2 py-2 text-right text-xs font-mono ${row.nettCashFlow < 0 ? 'text-red-600' : 'text-zinc-800'}`}>{row.health !== 'GREY' ? fmt(row.nettCashFlow) : '—'}</td>
                <td className="px-2 py-2 text-right text-xs font-mono text-zinc-800">{row.wip !== 0 ? fmt(row.wip) : '—'}</td>
                <td className="px-2 py-2 text-center"><HealthBadge health={row.health} /></td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && (
            <tfoot className="bg-zinc-50 border-t-2 border-zinc-300">
              <tr>
                <td colSpan={3} className="px-3 py-2 text-xs font-bold text-zinc-700">Totals ({filtered.length} projects)</td>
                <td className="px-2 py-2 text-right text-xs font-mono font-bold text-zinc-900">{fmt(filtered.reduce((s, r) => s + r.forecastContract, 0))}</td>
                <td className="px-2 py-2 text-right text-xs font-mono font-bold text-zinc-900">
                  {pct(filtered.filter((r) => r.forecastContract > 0).reduce((s, r) => s + r.forecastMarginPct * r.forecastContract, 0) /
                    (filtered.reduce((s, r) => s + r.forecastContract, 0) || 1))}
                </td>
                <td className="px-2 py-2 text-right text-xs font-mono font-bold text-zinc-900">{fmt(filtered.reduce((s, r) => s + r.marginToEarn, 0))}</td>
                <td className="px-2 py-2 text-right text-xs font-mono font-bold text-zinc-900">{fmt(filtered.reduce((s, r) => s + r.billingLessCost, 0))}</td>
                <td className="px-2 py-2 text-right text-xs font-mono font-bold text-zinc-900">{fmt(filtered.reduce((s, r) => s + r.marginRealised, 0))}</td>
                <td className="px-2 py-2 text-right text-xs font-mono font-bold text-zinc-900">{fmt(filtered.reduce((s, r) => s + r.overClaim, 0))}</td>
                <td className="px-2 py-2 text-right text-xs font-mono font-bold text-zinc-900">{fmt(filtered.reduce((s, r) => s + r.nettRetention, 0))}</td>
                <td className="px-2 py-2 text-right text-xs font-mono font-bold text-zinc-900">{fmt(filtered.reduce((s, r) => s + r.nettCashFlow, 0))}</td>
                <td className="px-2 py-2 text-right text-xs font-mono font-bold text-zinc-900">{fmt(filtered.reduce((s, r) => s + r.wip, 0))}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
