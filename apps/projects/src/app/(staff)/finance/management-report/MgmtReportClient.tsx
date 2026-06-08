'use client';

import { useState, useTransition, useRef, useId } from 'react';
import { useRouter } from 'next/navigation';
import type {
  MgmtReportPageData,
  MgmtSnapshotRecord,
  MgmtReportPageData as PageData,
} from '@/lib/management-report/actions';
import {
  lockReport,
  unlockReport,
  saveNotes,
} from '@/lib/management-report/actions';
import type { CVRProjectRow } from '@/lib/cvr/actions';
import { MONTH_LABELS } from '@/lib/revenue-budget/constants';

// ─── Formatting ───────────────────────────────────────────────────────────────

const AUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
const fmt = (v: number) => AUD.format(v);
const pct = (v: number) => (v * 100).toFixed(1) + '%';

function varColor(actual: number, budget: number, higherIsBetter = true): string {
  const diff = actual - budget;
  if (Math.abs(diff) < 100) return 'text-zinc-600';
  if (higherIsBetter) return diff > 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold';
  return diff < 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold';
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50">
        <h2 className="text-sm font-semibold text-zinc-800">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

// ─── Revenue Section ──────────────────────────────────────────────────────────

function RevenueSection({ data, monthKeys }: { data: PageData['revenue']; monthKeys: readonly string[] }) {
  const fy27Keys = monthKeys.filter((k): k is keyof typeof MONTH_LABELS => k in MONTH_LABELS);
  const rows = [
    { label: 'Budget', values: data.budget, cls: 'text-zinc-600' },
    { label: 'Secured', values: data.secured, cls: 'text-blue-700' },
    { label: 'Unsecured', values: data.unsecured, cls: 'text-purple-700' },
    { label: 'Actual', values: data.actual, cls: 'text-zinc-900 font-semibold' },
  ];

  const totals = rows.map((r) => fy27Keys.reduce((s, k) => s + (r.values[k] ?? 0), 0));
  const maxVal = Math.max(...rows.flatMap((r) => fy27Keys.map((k) => r.values[k] ?? 0)));

  // Simple bar chart: budget vs actual per month
  const chartKeys = fy27Keys;
  const chartMax = maxVal || 1;
  const H = 80;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="border border-zinc-100 rounded-lg p-3">
          <p className="text-xs text-zinc-500">Actual Revenue (month)</p>
          <p className="text-lg font-bold text-zinc-900">{fmt(data.actual[fy27Keys[fy27Keys.length - 1]] ?? 0)}</p>
        </div>
        <div className="border border-zinc-100 rounded-lg p-3">
          <p className="text-xs text-zinc-500">Budget (month)</p>
          <p className="text-lg font-bold text-zinc-600">{fmt(data.budget[fy27Keys[fy27Keys.length - 1]] ?? 0)}</p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="overflow-x-auto">
        <svg width={chartKeys.length * 52 + 40} height={H + 30} className="max-w-full">
          {chartKeys.map((k, i) => {
            const budgetH = Math.round(((data.budget[k] ?? 0) / chartMax) * H);
            const actualH = Math.round(((data.actual[k] ?? 0) / chartMax) * H);
            const bx = 20 + i * 52;
            return (
              <g key={k}>
                <rect x={bx} y={H - budgetH} width={20} height={budgetH} fill="#e4e4e7" rx={2} />
                <rect x={bx + 22} y={H - actualH} width={20} height={actualH} fill="#2563eb" rx={2} opacity={actualH === 0 ? 0.2 : 1} />
                <text x={bx + 21} y={H + 16} textAnchor="middle" fontSize={9} fill="#a1a1aa">
                  {MONTH_LABELS[k as keyof typeof MONTH_LABELS]?.replace(' ', '\n')}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="text-[10px] text-zinc-400 mt-1">Grey = Budget · Blue = Actual</p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="text-sm border-collapse" style={{ minWidth: `${160 + fy27Keys.length * 72}px` }}>
          <thead>
            <tr className="border-b border-zinc-200 text-[11px] text-zinc-500">
              <th className="px-3 py-2 text-left w-28">Row</th>
              {fy27Keys.map((k) => (
                <th key={k} className="px-2 py-2 text-right whitespace-nowrap">{MONTH_LABELS[k as keyof typeof MONTH_LABELS]}</th>
              ))}
              <th className="px-2 py-2 text-right border-l border-zinc-200 font-semibold text-zinc-700">FY Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={row.label} className={`border-b border-zinc-100 ${row.label === 'Actual' ? 'bg-zinc-50' : ''}`}>
                <td className={`px-3 py-1.5 text-xs font-medium ${row.cls}`}>{row.label}</td>
                {fy27Keys.map((k) => {
                  const v = row.values[k] ?? 0;
                  return (
                    <td key={k} className={`px-2 py-1.5 text-right text-xs font-mono ${v === 0 ? 'text-zinc-300' : row.cls}`}>
                      {v !== 0 ? fmt(v) : '—'}
                    </td>
                  );
                })}
                <td className={`px-2 py-1.5 text-right text-xs font-mono font-bold border-l border-zinc-200 ${row.cls}`}>
                  {fmt(totals[ri])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── P&L Section ─────────────────────────────────────────────────────────────

function PnLSection({ pnl }: { pnl: PageData['pnl'] }) {
  const rows = [
    { label: 'Revenue', budget: pnl.budgetRevenue, actual: pnl.actualRevenue, higherBetter: true },
    { label: 'Direct Costs', budget: pnl.budgetDirectCosts, actual: pnl.actualDirectCosts, higherBetter: false },
    { label: 'Gross Margin', budget: pnl.budgetGrossMargin, actual: pnl.actualGrossProfit, higherBetter: true, bold: true },
    { label: 'Gross Margin %', budgetPct: pnl.budgetGrossMarginPct, actualPct: pnl.actualGrossMarginPct, isPct: true, higherBetter: true },
    { label: 'Overheads', budget: pnl.budgetOverheads, actual: pnl.actualOverheads, higherBetter: false },
    { label: 'Net Profit', budget: pnl.budgetNetProfit, actual: pnl.actualNetProfit, higherBetter: true, bold: true },
    { label: 'Net Profit %', budgetPct: pnl.budgetNetProfitPct, actualPct: pnl.actualNetProfitPct, isPct: true, higherBetter: true },
  ];

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="border border-zinc-100 rounded-lg p-3">
          <p className="text-xs text-zinc-500">Actual Revenue (month)</p>
          <p className="text-base font-bold text-zinc-900">{fmt(pnl.actualRevenue)}</p>
        </div>
        <div className="border border-zinc-100 rounded-lg p-3">
          <p className="text-xs text-zinc-500">YTD Actual</p>
          <p className="text-base font-bold text-zinc-900">{fmt(pnl.ytdActualRevenue)}</p>
        </div>
        <div className="border border-zinc-100 rounded-lg p-3">
          <p className="text-xs text-zinc-500">YTD Budget</p>
          <p className="text-base font-bold text-zinc-600">{fmt(pnl.ytdBudgetRevenue)}</p>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-[11px] text-zinc-500">
            <th className="px-3 py-2 text-left">Line Item</th>
            <th className="px-2 py-2 text-right">Budget</th>
            <th className="px-2 py-2 text-right">Actual</th>
            <th className="px-2 py-2 text-right">Variance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            if (row.isPct) {
              const varPct = ((row.actualPct ?? 0) - (row.budgetPct ?? 0)) * 100;
              const vcls = Math.abs(varPct) < 0.5 ? 'text-zinc-600' : row.higherBetter
                ? (varPct > 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold')
                : (varPct < 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold');
              return (
                <tr key={row.label} className="border-b border-zinc-100">
                  <td className="px-3 py-1.5 text-xs text-zinc-600 pl-6">{row.label}</td>
                  <td className="px-2 py-1.5 text-right text-xs font-mono text-zinc-500">{pct(row.budgetPct ?? 0)}</td>
                  <td className="px-2 py-1.5 text-right text-xs font-mono text-zinc-800">{pct(row.actualPct ?? 0)}</td>
                  <td className={`px-2 py-1.5 text-right text-xs font-mono ${vcls}`}>{varPct > 0 ? '+' : ''}{varPct.toFixed(1)}pp</td>
                </tr>
              );
            }
            const b = row.budget ?? 0;
            const a = row.actual ?? 0;
            const variance = a - b;
            const vcls = varColor(a, b, row.higherBetter);
            return (
              <tr key={row.label} className={`border-b border-zinc-100 ${row.bold ? 'bg-zinc-50' : ''}`}>
                <td className={`px-3 py-1.5 text-xs ${row.bold ? 'font-semibold text-zinc-900' : 'text-zinc-600'}`}>{row.label}</td>
                <td className="px-2 py-1.5 text-right text-xs font-mono text-zinc-500">{fmt(b)}</td>
                <td className={`px-2 py-1.5 text-right text-xs font-mono ${row.bold ? 'font-semibold text-zinc-900' : 'text-zinc-800'}`}>{fmt(a)}</td>
                <td className={`px-2 py-1.5 text-right text-xs font-mono ${vcls}`}>{variance >= 0 ? '+' : ''}{fmt(variance)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── CVR Summary Section ──────────────────────────────────────────────────────

function CVRSection({ rows }: { rows: CVRProjectRow[] }) {
  const totals = {
    forecastContract: rows.reduce((s, r) => s + r.forecastContract, 0),
    marginToEarn: rows.reduce((s, r) => s + r.marginToEarn, 0),
    wip: rows.reduce((s, r) => s + r.wip, 0),
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-[11px] text-zinc-500">
            <th className="px-3 py-2 text-left">Job</th>
            <th className="px-3 py-2 text-left">Project</th>
            <th className="px-2 py-2 text-left">Class</th>
            <th className="px-2 py-2 text-right">Contract</th>
            <th className="px-2 py-2 text-right">Margin %</th>
            <th className="px-2 py-2 text-right">Margin to Earn</th>
            <th className="px-2 py-2 text-right">WIP</th>
            <th className="px-2 py-2 text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.projectId} className="border-b border-zinc-100 hover:bg-zinc-50">
              <td className="px-3 py-1.5 text-xs font-mono text-blue-700">{r.jobNo}</td>
              <td className="px-3 py-1.5 text-xs text-zinc-800 max-w-xs truncate">{r.projectName}</td>
              <td className="px-2 py-1.5 text-xs text-zinc-500">{r.classification ?? '—'}</td>
              <td className="px-2 py-1.5 text-right text-xs font-mono">{r.health !== 'GREY' ? fmt(r.forecastContract) : '—'}</td>
              <td className={`px-2 py-1.5 text-right text-xs font-mono ${r.forecastMarginPct < 0.10 && r.health !== 'GREY' ? 'text-red-600' : ''}`}>
                {r.health !== 'GREY' ? pct(r.forecastMarginPct) : '—'}
              </td>
              <td className={`px-2 py-1.5 text-right text-xs font-mono ${r.marginToEarn < 0 ? 'text-red-600' : ''}`}>
                {r.health !== 'GREY' ? fmt(r.marginToEarn) : '—'}
              </td>
              <td className="px-2 py-1.5 text-right text-xs font-mono">{r.wip !== 0 ? fmt(r.wip) : '—'}</td>
              <td className="px-2 py-1.5 text-center text-xs">
                {r.health === 'GREEN' ? '✅' : r.health === 'AMBER' ? '⚠' : r.health === 'RED' ? '🔴' : '—'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-zinc-50 border-t-2 border-zinc-300">
          <tr>
            <td colSpan={3} className="px-3 py-1.5 text-xs font-bold text-zinc-700">Totals</td>
            <td className="px-2 py-1.5 text-right text-xs font-mono font-bold">{fmt(totals.forecastContract)}</td>
            <td />
            <td className="px-2 py-1.5 text-right text-xs font-mono font-bold">{fmt(totals.marginToEarn)}</td>
            <td className="px-2 py-1.5 text-right text-xs font-mono font-bold">{fmt(totals.wip)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Cash Position Section ────────────────────────────────────────────────────

function CashSection({ cashPosition }: { cashPosition: PageData['cashPosition'] }) {
  const curr = cashPosition.current;
  const prior = cashPosition.prior;

  if (!curr) return <p className="text-sm text-zinc-400">No Balance Sheet data. <a href="/finance/balance-sheet" className="underline">Sync Balance Sheet</a> to populate.</p>;

  const rows = [
    { label: 'Cash and Bank', curr: curr.cash, prior: prior?.cash ?? 0 },
    { label: 'Accounts Receivable', curr: curr.ar, prior: prior?.ar ?? 0 },
    { label: 'Accounts Payable', curr: curr.ap, prior: prior?.ap ?? 0 },
    { label: 'Retentions Held', curr: curr.retentions, prior: prior?.retentions ?? 0 },
  ];
  const currNWC = curr.cash + curr.ar - curr.ap;
  const priorNWC = (prior?.cash ?? 0) + (prior?.ar ?? 0) - (prior?.ap ?? 0);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-zinc-200 text-[11px] text-zinc-500">
          <th className="px-3 py-2 text-left">Item</th>
          <th className="px-2 py-2 text-right">This Month</th>
          <th className="px-2 py-2 text-right">Prior Month</th>
          <th className="px-2 py-2 text-right">Movement</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-zinc-100">
            <td className="px-3 py-1.5 text-xs text-zinc-600">{r.label}</td>
            <td className="px-2 py-1.5 text-right text-xs font-mono text-zinc-900">{fmt(r.curr)}</td>
            <td className="px-2 py-1.5 text-right text-xs font-mono text-zinc-500">{prior ? fmt(r.prior) : '—'}</td>
            <td className={`px-2 py-1.5 text-right text-xs font-mono ${r.curr - r.prior > 0 ? 'text-emerald-600' : r.curr - r.prior < 0 ? 'text-red-600' : 'text-zinc-400'}`}>
              {prior ? (r.curr - r.prior >= 0 ? '+' : '') + fmt(r.curr - r.prior) : '—'}
            </td>
          </tr>
        ))}
        <tr className="bg-zinc-50 border-t-2 border-zinc-300">
          <td className="px-3 py-1.5 text-xs font-bold text-zinc-900">Net Working Capital</td>
          <td className="px-2 py-1.5 text-right text-xs font-mono font-bold text-zinc-900">{fmt(currNWC)}</td>
          <td className="px-2 py-1.5 text-right text-xs font-mono font-semibold text-zinc-500">{prior ? fmt(priorNWC) : '—'}</td>
          <td className={`px-2 py-1.5 text-right text-xs font-mono font-semibold ${currNWC - priorNWC >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {prior ? (currNWC - priorNWC >= 0 ? '+' : '') + fmt(currNWC - priorNWC) : '—'}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

// ─── WIP Section ──────────────────────────────────────────────────────────────

function WIPSection({ wip }: { wip: PageData['wipSummary'] }) {
  if (!wip) return <p className="text-sm text-zinc-400">No locked month-end WIP data available.</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Prior Month WIP', value: fmt(wip.priorMonthWip) },
          { label: 'This Month WIP', value: fmt(wip.currentMonthWip) },
          { label: 'Movement', value: (wip.movement >= 0 ? '+' : '') + fmt(wip.movement), red: wip.movement > 0 },
          { label: 'Journal Status', value: wip.journalPosted ? '✅ Posted' : '⏳ Pending' },
        ].map((c) => (
          <div key={c.label} className="border border-zinc-100 rounded-lg p-3">
            <p className="text-xs text-zinc-500">{c.label}</p>
            <p className={`text-sm font-bold ${c.red ? 'text-red-600' : 'text-zinc-900'}`}>{c.value}</p>
          </div>
        ))}
      </div>
      {wip.perProject.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-[11px] text-zinc-500">
              <th className="px-3 py-2 text-left">Job</th>
              <th className="px-3 py-2 text-left">Project</th>
              <th className="px-2 py-2 text-right">WIP</th>
              <th className="px-2 py-2 text-right">Movement</th>
            </tr>
          </thead>
          <tbody>
            {wip.perProject.map((p, i) => (
              <tr key={i} className="border-b border-zinc-100">
                <td className="px-3 py-1.5 text-xs font-mono text-zinc-700">{p.jobNo}</td>
                <td className="px-3 py-1.5 text-xs text-zinc-800 max-w-xs truncate">{p.projectName}</td>
                <td className="px-2 py-1.5 text-right text-xs font-mono">{fmt(p.wip)}</td>
                <td className={`px-2 py-1.5 text-right text-xs font-mono ${p.movement > 0 ? 'text-red-600' : p.movement < 0 ? 'text-emerald-600' : 'text-zinc-400'}`}>
                  {(p.movement >= 0 ? '+' : '') + fmt(p.movement)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Rolling Forecast Section ─────────────────────────────────────────────────

function RollingForecastSection({ revenue, monthKeys, selectedYear, selectedMonth }: {
  revenue: PageData['revenue'];
  monthKeys: readonly string[];
  selectedYear: number;
  selectedMonth: number;
}) {
  const fy27Keys = monthKeys.filter((k): k is keyof typeof MONTH_LABELS => k in MONTH_LABELS);

  // Show current month and forward
  const MONTH_KEY_TO_YM: Record<string, { year: number; month: number }> = {
    jul26: { year: 2026, month: 7 }, aug26: { year: 2026, month: 8 }, sep26: { year: 2026, month: 9 },
    oct26: { year: 2026, month: 10 }, nov26: { year: 2026, month: 11 }, dec26: { year: 2026, month: 12 },
    jan27: { year: 2027, month: 1 }, feb27: { year: 2027, month: 2 }, mar27: { year: 2027, month: 3 },
    apr27: { year: 2027, month: 4 }, may27: { year: 2027, month: 5 }, jun27: { year: 2027, month: 6 },
  };
  const forwardKeys = fy27Keys.filter((k) => {
    const ym = MONTH_KEY_TO_YM[k];
    if (!ym) return false;
    return ym.year > selectedYear || (ym.year === selectedYear && ym.month >= selectedMonth);
  });

  const rows = [
    { label: 'Budget', values: revenue.budget, cls: 'text-zinc-600' },
    { label: 'Secured', values: revenue.secured, cls: 'text-blue-700' },
    { label: 'Unsecured', values: revenue.unsecured, cls: 'text-purple-700' },
  ];

  return (
    <div className="overflow-x-auto">
      <p className="text-xs text-zinc-400 mb-3">Forward 12 months from selected month — Budget, Secured, and Unsecured revenue spreads.</p>
      <table className="text-sm border-collapse" style={{ minWidth: `${160 + forwardKeys.length * 72}px` }}>
        <thead>
          <tr className="border-b border-zinc-200 text-[11px] text-zinc-500">
            <th className="px-3 py-2 text-left w-28">Row</th>
            {forwardKeys.map((k) => (
              <th key={k} className="px-2 py-2 text-right whitespace-nowrap">{MONTH_LABELS[k as keyof typeof MONTH_LABELS]}</th>
            ))}
            <th className="px-2 py-2 text-right border-l border-zinc-200 font-semibold text-zinc-700">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const total = forwardKeys.reduce((s, k) => s + (row.values[k] ?? 0), 0);
            return (
              <tr key={row.label} className="border-b border-zinc-100">
                <td className={`px-3 py-1.5 text-xs font-medium ${row.cls}`}>{row.label}</td>
                {forwardKeys.map((k) => {
                  const v = row.values[k] ?? 0;
                  return <td key={k} className={`px-2 py-1.5 text-right text-xs font-mono ${v === 0 ? 'text-zinc-300' : row.cls}`}>{v !== 0 ? fmt(v) : '—'}</td>;
                })}
                <td className={`px-2 py-1.5 text-right text-xs font-mono font-bold border-l border-zinc-200 ${row.cls}`}>{fmt(total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Notes Section ────────────────────────────────────────────────────────────

function NotesSection({ snapshot, onSave }: { snapshot: MgmtSnapshotRecord; onSave: (notes: string) => Promise<void> }) {
  const [text, setText] = useState(snapshot.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const isLocked = snapshot.status === 'LOCKED';

  async function handleSave() {
    setSaving(true);
    await onSave(text);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setSaved(false); }}
        disabled={isLocked}
        rows={6}
        className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm resize-none disabled:bg-zinc-50 disabled:text-zinc-500"
        placeholder={isLocked ? 'Report is locked. Notes are read-only.' : 'Add commentary for this report month…'}
      />
      {!isLocked && (
        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-1.5 text-sm bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Notes'}
          </button>
          {saved && <span className="text-xs text-emerald-600">✓ Saved</span>}
        </div>
      )}
    </div>
  );
}

// ─── Lock / Unlock Modals ─────────────────────────────────────────────────────

function LockModal({ conditions, onLock, onClose }: {
  conditions: PageData['lockPreConditions'];
  onLock: () => Promise<void>;
  onClose: () => void;
}) {
  const [locking, setLocking] = useState(false);
  const canLock = conditions.monthEndLocked && conditions.pnlExists && conditions.bsExists;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl border border-zinc-200 p-6 w-full max-w-sm mx-4">
        <h3 className="text-base font-semibold text-zinc-900 mb-4">Lock Report</h3>
        <div className="space-y-2 mb-5">
          {[
            { label: 'Month-end LOCKED', ok: conditions.monthEndLocked },
            { label: 'Xero P&L synced', ok: conditions.pnlExists },
            { label: 'Balance Sheet synced', ok: conditions.bsExists },
          ].map((c) => (
            <div key={c.label} className={`flex items-center gap-2 text-sm ${c.ok ? 'text-emerald-700' : 'text-red-600'}`}>
              <span>{c.ok ? '✅' : '✗'}</span> {c.label}
            </div>
          ))}
        </div>
        {!canLock && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5 mb-4">
            All pre-conditions must be met before locking.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 border border-zinc-300 rounded-lg hover:bg-zinc-50">Cancel</button>
          <button
            onClick={async () => { setLocking(true); await onLock(); setLocking(false); onClose(); }}
            disabled={!canLock || locking}
            className="px-4 py-2 text-sm bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50"
          >
            {locking ? 'Locking…' : 'Lock Report'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UnlockModal({ onUnlock, onClose }: { onUnlock: (reason: string) => Promise<void>; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl border border-zinc-200 p-6 w-full max-w-sm mx-4">
        <h3 className="text-base font-semibold text-zinc-900 mb-2">Unlock Report</h3>
        <p className="text-sm text-zinc-600 mb-4">This will clear the frozen snapshot. Please provide a reason (minimum 20 characters).</p>
        <textarea value={reason} onChange={(e) => { setReason(e.target.value); setError(''); }}
          rows={3} placeholder="Reason for unlocking…"
          className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm resize-none mb-1" />
        <p className="text-xs text-zinc-400 mb-3">{reason.length}/20 characters</p>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 border border-zinc-300 rounded-lg hover:bg-zinc-50">Cancel</button>
          <button
            onClick={async () => {
              if (reason.length < 20) { setError('Reason must be at least 20 characters.'); return; }
              setUnlocking(true);
              await onUnlock(reason);
              setUnlocking(false);
              onClose();
            }}
            disabled={unlocking}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {unlocking ? 'Unlocking…' : 'Unlock'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MgmtReportClient({ initialData }: { initialData: MgmtReportPageData }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [snapshot, setSnapshot] = useState(initialData.snapshot);
  const [showLock, setShowLock] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  const isLocked = snapshot.status === 'LOCKED';
  const data = isLocked && snapshot.snapshotData ? snapshot.snapshotData as MgmtReportPageData : initialData;

  const monthLabel = new Date(initialData.selectedYear, initialData.selectedMonth - 1, 1)
    .toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });

  function handleMonthChange(val: string) {
    const [y, m] = val.split('-').map(Number);
    startTransition(() => router.push(`/finance/management-report?year=${y}&month=${m}`));
  }

  async function handleLock() {
    const res = await lockReport(snapshot.id, initialData);
    if (res.ok) setSnapshot({ ...snapshot, status: 'LOCKED' });
  }

  async function handleUnlock(reason: string) {
    const res = await unlockReport(snapshot.id, reason);
    if (res.ok) { setSnapshot({ ...snapshot, status: 'DRAFT', snapshotData: null, lockedAt: null }); router.refresh(); }
  }

  async function handleSaveNotes(notes: string) {
    await saveNotes(snapshot.id, notes);
    setSnapshot({ ...snapshot, notes });
  }

  async function handleExportPDF() {
    setExportingPDF(true);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { MgmtReportPDF } = await import('./MgmtReportPDF');
      const blob = await pdf(<MgmtReportPDF data={initialData} snapshot={snapshot} monthLabel={monthLabel} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `management-report-${initialData.selectedYear}-${String(initialData.selectedMonth).padStart(2, '0')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('PDF export error:', e);
    } finally {
      setExportingPDF(false);
    }
  }

  const navLinks = ['Revenue', 'P&L', 'Projects', 'Cash', 'WIP', 'Forecast', 'Notes'];

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-white border-b border-zinc-200 shadow-sm">
        <div className="flex items-center justify-between gap-4 px-6 py-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-zinc-900">Management Report — {monthLabel}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isLocked ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {isLocked ? 'LOCKED' : 'DRAFT'}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Month selector */}
            <select
              value={`${initialData.selectedYear}-${initialData.selectedMonth}`}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="border border-zinc-300 rounded-lg px-2 py-1 text-sm bg-white"
            >
              {initialData.availableMonths.map((m) => (
                <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>{m.label}</option>
              ))}
            </select>

            {!isLocked && (
              <button onClick={() => setShowLock(true)}
                className="px-3 py-1.5 text-sm bg-zinc-900 text-white rounded-lg hover:bg-zinc-700">
                Lock Report
              </button>
            )}
            {isLocked && (
              <button onClick={() => setShowUnlock(true)}
                className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50">
                Unlock
              </button>
            )}
            <button onClick={handleExportPDF} disabled={exportingPDF}
              className="px-3 py-1.5 text-sm border border-zinc-300 rounded-lg hover:bg-zinc-50 disabled:opacity-50">
              {exportingPDF ? 'Generating…' : '↓ Export PDF'}
            </button>
          </div>
        </div>
        {/* Section nav */}
        <div className="flex gap-1 px-6 pb-2 overflow-x-auto">
          {navLinks.map((nav) => (
            <a key={nav} href={`#mgmt-${nav.toLowerCase()}`}
              className="px-3 py-1 text-xs text-zinc-500 rounded-full hover:bg-zinc-100 hover:text-zinc-800 whitespace-nowrap">
              {nav}
            </a>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <Section id="mgmt-revenue" title="Revenue">
          <RevenueSection data={data.revenue} monthKeys={data.fy27MonthKeys} />
        </Section>

        <Section id="mgmt-p&l" title="P&L — Actual vs Budget">
          <PnLSection pnl={data.pnl} />
        </Section>

        <Section id="mgmt-projects" title="Project CVR Summary">
          <CVRSection rows={data.cvrRows} />
        </Section>

        <Section id="mgmt-cash" title="Cash Position">
          <CashSection cashPosition={data.cashPosition} />
        </Section>

        <Section id="mgmt-wip" title="WIP Summary">
          <WIPSection wip={data.wipSummary} />
        </Section>

        <Section id="mgmt-forecast" title="Rolling Forecast (12-Month Forward)">
          <RollingForecastSection
            revenue={data.revenue}
            monthKeys={data.fy27MonthKeys}
            selectedYear={initialData.selectedYear}
            selectedMonth={initialData.selectedMonth}
          />
        </Section>

        <Section id="mgmt-notes" title="Notes &amp; Commentary">
          <NotesSection snapshot={snapshot} onSave={handleSaveNotes} />
        </Section>
      </div>

      {showLock && (
        <LockModal conditions={initialData.lockPreConditions} onLock={handleLock} onClose={() => setShowLock(false)} />
      )}
      {showUnlock && (
        <UnlockModal onUnlock={handleUnlock} onClose={() => setShowUnlock(false)} />
      )}
    </div>
  );
}
