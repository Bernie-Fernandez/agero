'use client';

import Link from 'next/link';
import type { CVRDetailRow } from '@/lib/cvr/actions';

// ─── Formatting ───────────────────────────────────────────────────────────────

const AUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
const fmt = (v: number | null | undefined) => v == null ? '—' : AUD.format(v);
const pct = (v: number | null | undefined) => v == null ? '—' : (v * 100).toFixed(2) + '%';
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { month: 'short', year: '2-digit' });

// ─── SVG Margin Trend Chart ───────────────────────────────────────────────────

function MarginTrendChart({ history }: { history: { asAtDate: string; forecastMarginPct: number }[] }) {
  const points = history.map((h) => ({ date: fmtDate(h.asAtDate), pct: h.forecastMarginPct * 100 })).reverse();
  if (points.length < 2) {
    return <div className="text-sm text-zinc-400 py-8 text-center">Not enough history for trend chart (need ≥ 2 months)</div>;
  }

  const W = 600, H = 180, PAD = { top: 16, right: 24, bottom: 32, left: 56 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const minPct = Math.min(...points.map((p) => p.pct), 0);
  const maxPct = Math.max(...points.map((p) => p.pct), 20);
  const range = maxPct - minPct || 1;

  const x = (i: number) => PAD.left + (i / (points.length - 1)) * chartW;
  const y = (v: number) => PAD.top + ((maxPct - v) / range) * chartH;

  const polyline = points.map((p, i) => `${x(i)},${y(p.pct)}`).join(' ');

  // Check declining trend
  let declineCount = 0;
  for (let i = points.length - 1; i > 0; i--) {
    if (points[i].pct < points[i - 1].pct) declineCount++;
    else break;
  }

  return (
    <div>
      {declineCount >= 3 && (
        <div className="mb-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          ⚠ Margin has declined for {declineCount} consecutive months.
        </div>
      )}
      <div className="overflow-x-auto">
        <svg width={W} height={H} className="max-w-full">
          {/* Grid lines */}
          {[0, 5, 10, 15, 20].map((v) => (
            v >= minPct && v <= maxPct + 2 ? (
              <g key={v}>
                <line x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)} stroke="#e4e4e7" strokeWidth={1} />
                <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" fontSize={10} fill="#a1a1aa">{v}%</text>
              </g>
            ) : null
          ))}
          {/* 10% reference line */}
          {10 >= minPct && 10 <= maxPct + 2 && (
            <line x1={PAD.left} y1={y(10)} x2={W - PAD.right} y2={y(10)} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4,3" />
          )}
          {/* Line */}
          <polyline points={polyline} fill="none" stroke="#2563eb" strokeWidth={2} strokeLinejoin="round" />
          {/* Points */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={x(i)} cy={y(p.pct)} r={4} fill={p.pct < 10 ? '#ef4444' : '#2563eb'} />
              <text x={x(i)} y={H - PAD.bottom + 14} textAnchor="middle" fontSize={10} fill="#71717a">{p.date}</text>
            </g>
          ))}
        </svg>
      </div>
      <p className="text-[11px] text-zinc-400 mt-1">Dashed line = 10% margin threshold</p>
    </div>
  );
}

// ─── Row helpers ──────────────────────────────────────────────────────────────

function DataRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-0">
      <span className="text-xs text-zinc-600">{label}</span>
      <span className={`text-xs font-mono font-medium ${highlight ? 'text-red-600' : 'text-zinc-900'}`}>{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-zinc-800 mb-3">{children}</h3>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CVRDetailClient({ data }: { data: CVRDetailRow }) {
  const { project, backlogBudget, latestSnapshot, snapshotHistory, wipHistory } = data;

  const classLabel = backlogBudget?.classification
    ? backlogBudget.classification.charAt(0) + backlogBudget.classification.slice(1).toLowerCase()
    : 'Unknown';

  const marginPct = latestSnapshot?.forecastMarginPct ?? project.forecastMarginPercent;
  const health = marginPct < 0 || (latestSnapshot?.marginToEarn ?? 0) < 0 ? 'RED'
    : marginPct < 0.05 ? 'RED'
    : marginPct < 0.10 ? 'AMBER'
    : 'GREEN';
  const healthColor = { GREEN: 'text-emerald-600', AMBER: 'text-amber-600', RED: 'text-red-600' }[health];

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <Link href="/finance/cvr" className="text-xs text-zinc-500 hover:underline">← Back to CVR</Link>
        <div className="mt-2 flex items-start gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-zinc-900">{project.jobNo} — {project.projectName}</h1>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${backlogBudget?.classification === 'AWARDED' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
            {classLabel}
          </span>
          <span className={`text-xs font-semibold ${healthColor}`}>
            {health === 'RED' ? '🔴 At Risk' : health === 'AMBER' ? '⚠ Watch' : '✅ On Track'}
          </span>
        </div>
        {latestSnapshot && (
          <p className="text-sm text-zinc-500 mt-1">CAT data as at: {fmtDate(latestSnapshot.asAtDate)}</p>
        )}
      </div>

      {/* Section 1 — Current Position */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left — Contract & Forecast */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <SectionTitle>Contract &amp; Forecast</SectionTitle>
          <DataRow label="Forecast Contract Value" value={fmt(project.forecastContractValue)} />
          <DataRow label="Forecast Final Costs" value={fmt(project.forecastFinalCosts)} />
          <DataRow label="R&O Adjustment" value={fmt(project.riskAndOpportunity)} />
          <DataRow label="Forecast Margin ($)" value={fmt(project.forecastMarginDollars)} />
          <DataRow
            label="Forecast Margin %"
            value={pct(project.forecastMarginPercent)}
            highlight={project.forecastMarginPercent < 0.10}
          />
          {project.targetExitMarginPercent != null && (
            <DataRow label="Target Exit Margin %" value={pct(project.targetExitMarginPercent)} />
          )}
          <DataRow label="Total Costs to Date" value={fmt(project.totalCost)} />
          <DataRow label="Claims Total" value={fmt(project.claimTotal)} />
          <DataRow label="Less Retentions" value={fmt(project.claimRetention)} />
        </div>

        {/* Right — Six Dropped Columns */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <SectionTitle>WIP Position — Six CAT Columns</SectionTitle>
          {latestSnapshot ? (
            <>
              <DataRow label="WIP" value={fmt(latestSnapshot.wip)} />
              <DataRow label="Billing Less Cost" value={fmt(latestSnapshot.billingLessCost)} />
              <DataRow label="Margin to Earn" value={fmt(latestSnapshot.marginToEarn)} highlight={latestSnapshot.marginToEarn < 0} />
              <DataRow label="Margin Realised" value={fmt(latestSnapshot.marginRealised)} />
              <DataRow label="Over Claim" value={fmt(latestSnapshot.overClaim)} highlight={latestSnapshot.overClaim < 0} />
              <DataRow label="Nett Retention" value={fmt(latestSnapshot.nettRetention)} />
              <DataRow label="Nett Cash Flow" value={fmt(latestSnapshot.nettCashFlow)} highlight={latestSnapshot.nettCashFlow < 0} />
            </>
          ) : (
            <>
              <DataRow label="Billing Less Cost" value={fmt(project.billingLessCost)} />
              <DataRow label="Margin to Earn" value={fmt(project.marginToEarn)} highlight={(project.marginToEarn ?? 0) < 0} />
              <DataRow label="Margin Realised" value={fmt(project.marginRealised)} />
              <DataRow label="Over Claim" value={fmt(project.overClaim)} highlight={(project.overClaim ?? 0) < 0} />
              <DataRow label="Nett Retention" value={fmt(project.nettRetention)} />
              <DataRow label="Nett Cash Flow" value={fmt(project.nettCashFlow)} highlight={(project.nettCashFlow ?? 0) < 0} />
            </>
          )}
        </div>
      </div>

      {/* Section 2 — 6-Month Margin Trend */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4">
        <SectionTitle>6-Month Forecast Margin % Trend</SectionTitle>
        <MarginTrendChart history={snapshotHistory} />
      </div>

      {/* Section 3 — WIP History */}
      {wipHistory.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100">
            <SectionTitle>WIP History</SectionTitle>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr className="text-[11px] text-zinc-500">
                <th className="px-3 py-2 text-left">Month</th>
                <th className="px-3 py-2 text-right">CAT WIP</th>
                <th className="px-3 py-2 text-right">Prior Month WIP</th>
                <th className="px-3 py-2 text-right">Movement</th>
                <th className="px-3 py-2 text-center">Journal Status</th>
                <th className="px-3 py-2 text-center">Month Status</th>
              </tr>
            </thead>
            <tbody>
              {wipHistory.map((w, i) => (
                <tr key={i} className="border-b border-zinc-100 hover:bg-zinc-50">
                  <td className="px-3 py-2 text-xs font-medium text-zinc-800">{w.monthLabel}</td>
                  <td className="px-3 py-2 text-right text-xs font-mono">{fmt(w.catWip)}</td>
                  <td className="px-3 py-2 text-right text-xs font-mono text-zinc-500">{fmt(w.priorMonthWip)}</td>
                  <td className={`px-3 py-2 text-right text-xs font-mono ${w.wipMovement > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {w.wipMovement > 0 ? '+' : ''}{fmt(w.wipMovement)}
                  </td>
                  <td className="px-3 py-2 text-center text-xs">
                    {w.journalPostedAt ? <span className="text-emerald-600">✅ Posted</span> : <span className="text-zinc-400">⏳ Pending</span>}
                  </td>
                  <td className="px-3 py-2 text-center text-xs">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${w.monthEndStatus === 'LOCKED' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                      {w.monthEndStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Section 4 — Revenue Budget vs Budget (note about actuals) */}
      {Object.keys(data.revenueBudget).length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100">
            <SectionTitle>Revenue Budget Spread (FY27)</SectionTitle>
          </div>
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr className="text-[11px] text-zinc-500">
                  {Object.keys(data.revenueBudget).map((k) => (
                    <th key={k} className="px-3 py-2 text-right whitespace-nowrap">{k.replace('26', ' 26').replace('27', ' 27')}</th>
                  ))}
                  <th className="px-3 py-2 text-right font-bold border-l border-zinc-200">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {Object.values(data.revenueBudget).map((v, i) => (
                    <td key={i} className="px-3 py-2 text-right text-xs font-mono">{v ? AUD.format(v) : '—'}</td>
                  ))}
                  <td className="px-3 py-2 text-right text-xs font-mono font-bold border-l border-zinc-200">
                    {AUD.format(Object.values(data.revenueBudget).reduce((s, v) => s + v, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2 text-[11px] text-zinc-400 border-t border-zinc-100">
            Actual figures are business-level totals from Xero — project-level actuals available when Project Direct Delivery module is built.
          </p>
        </div>
      )}
    </div>
  );
}
