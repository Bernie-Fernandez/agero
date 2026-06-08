'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { syncLatestMonth } from '../xero-pnl/actions';
import type { BSSnapshotRow } from '../balance-sheet/actions';

// ─── Formatting helpers ───────────────────────────────────────────────────────

const AUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
const AUD2 = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 });

function fmtAUD(v: number) { return AUD.format(v); }
function fmtPct(v: number) { return v.toFixed(1) + '%'; }

function fmtDateTime(iso: string | null) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function monthLabel(month: number) { return MONTHS[month - 1] ?? String(month); }

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  colour,
}: {
  label: string;
  value: string;
  colour: 'blue' | 'green' | 'red' | 'amber';
}) {
  const colourMap = {
    blue: 'text-blue-700 bg-blue-50 border-blue-200',
    green: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    red: 'text-red-700 bg-red-50 border-red-200',
    amber: 'text-amber-700 bg-amber-50 border-amber-200',
  };
  return (
    <div className={`rounded-xl border p-5 flex flex-col gap-1 ${colourMap[colour]}`}>
      <span className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</span>
      <span className="text-2xl font-bold">{value}</span>
    </div>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────

type ChartRow = {
  month: number;
  year: number;
  totalIncome: unknown;
  grossProfit: unknown;
};

function BarChart({ data }: { data: ChartRow[] }) {
  const maxVal = Math.max(
    ...data.map((r) => Math.abs(Number(String(r.totalIncome ?? '0')))),
    1,
  );

  return (
    <div className="flex items-end gap-2 h-48">
      {data.map((row) => {
        const rev = Number(String(row.totalIncome ?? '0'));
        const gp = Number(String(row.grossProfit ?? '0'));
        const revH = Math.max((rev / maxVal) * 100, 2);
        const gpH = Math.max((Math.abs(gp) / maxVal) * 100, 2);
        const gpNeg = gp < 0;
        return (
          <Link
            key={`${row.year}-${row.month}`}
            href="/finance/xero-pnl"
            title={`${monthLabel(row.month)} ${row.year} — Revenue: ${AUD2.format(rev)}, Gross Profit: ${AUD2.format(gp)}`}
            className="flex-1 flex flex-col items-center gap-1 group"
          >
            <div className="w-full flex items-end justify-center gap-0.5 h-44">
              <div
                className="flex-1 bg-blue-500 rounded-t group-hover:bg-blue-600 transition-colors"
                style={{ height: `${revH}%` }}
              />
              <div
                className={`flex-1 rounded-t group-hover:opacity-80 transition-colors ${gpNeg ? 'bg-red-400' : 'bg-emerald-400'}`}
                style={{ height: `${gpH}%` }}
              />
            </div>
            <span className="text-[10px] text-zinc-500">{monthLabel(row.month)}</span>
          </Link>
        );
      })}
      {data.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">
          No data synced yet
        </div>
      )}
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

type Props = {
  ytdRevenue: number;
  ytdGrossProfit: number;
  ytdNetProfit: number;
  grossMarginPct: number;
  chartData: ChartRow[];
  lastSyncAt: string | null;
  topExpenses: { name: string; amount: number }[];
  latestBS: BSSnapshotRow | null;
};

export default function DashboardClient({
  ytdRevenue,
  ytdGrossProfit,
  ytdNetProfit,
  grossMarginPct,
  chartData,
  lastSyncAt,
  topExpenses,
  latestBS,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState(false);

  function handleSync() {
    setSyncError(null);
    setSyncSuccess(false);
    startTransition(async () => {
      const result = await syncLatestMonth();
      if (result.ok) {
        setSyncSuccess(true);
        router.refresh();
      } else {
        setSyncError(result.error ?? 'Sync failed.');
      }
    });
  }

  const gpColour = ytdGrossProfit >= 0 ? 'green' : 'red';
  const npColour = ytdNetProfit >= 0 ? 'green' : 'red';
  const gmColour: 'green' | 'amber' | 'red' =
    grossMarginPct >= 15 ? 'green' : grossMarginPct >= 5 ? 'amber' : 'red';

  const top5Expenses = [...topExpenses]
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 5);

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <h1 className="text-xl font-bold text-zinc-900">Finance Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="YTD Revenue" value={fmtAUD(ytdRevenue)} colour="blue" />
        <KpiCard
          label="YTD Gross Profit"
          value={fmtAUD(ytdGrossProfit)}
          colour={gpColour}
        />
        <KpiCard
          label="YTD Profit"
          value={fmtAUD(ytdNetProfit)}
          colour={npColour}
        />
        <KpiCard
          label="Gross Margin"
          value={fmtPct(grossMarginPct)}
          colour={gmColour}
        />
      </div>

      {/* Balance Sheet KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        {latestBS ? (
          <>
            <KpiCard label="Total Assets" value={AUD.format(Number(latestBS.totalAssets ?? 0))} colour="blue" />
            <KpiCard label="Total Liabilities" value={AUD.format(Number(latestBS.totalLiabilities ?? 0))} colour="amber" />
            <KpiCard
              label="Net Equity"
              value={AUD.format(Number(latestBS.totalEquity ?? 0))}
              colour={Number(latestBS.totalEquity ?? 0) >= 0 ? 'green' : 'red'}
            />
          </>
        ) : (
          <div className="col-span-3 bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-sm text-zinc-500">
            Balance Sheet not synced yet.{' '}
            <Link href="/finance/balance-sheet" className="text-blue-600 hover:underline">
              Go to Balance Sheet →
            </Link>
          </div>
        )}
      </div>

      {/* Bar chart */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-700">Monthly Revenue &amp; Gross Profit</h2>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Revenue
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" /> Gross Profit
            </span>
          </div>
        </div>
        <BarChart data={chartData} />
      </div>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Last sync */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-700">Xero Sync</h2>
          <div className="text-xs text-zinc-500">
            Last synced: <span className="font-medium text-zinc-700">{fmtDateTime(lastSyncAt)}</span>
          </div>
          {syncError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {syncError}
            </p>
          )}
          {syncSuccess && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
              Latest month synced successfully.
            </p>
          )}
          <button
            onClick={handleSync}
            disabled={isPending}
            className="w-full bg-zinc-900 text-white text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? 'Syncing…' : 'Sync Latest Month'}
          </button>
          <p className="text-xs text-zinc-400">
            Pulls the current month&apos;s P&amp;L from Xero and updates this dashboard.
          </p>
          <Link
            href="/finance/xero-pnl"
            className="block text-xs text-blue-600 hover:underline"
          >
            View full P&amp;L history →
          </Link>
        </div>

        {/* Top expenses */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-700">Top Expenses — Latest Month</h2>
          {top5Expenses.length === 0 ? (
            <p className="text-sm text-zinc-400">No expense data yet. Sync a month to see expenses.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {top5Expenses.map((exp, i) => (
                <li key={i} className="flex items-center justify-between py-2">
                  <span className="text-sm text-zinc-700">{exp.name}</span>
                  <span className="text-sm font-medium text-zinc-900">{AUD2.format(Math.abs(exp.amount))}</span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/finance/xero-pnl"
            className="block text-xs text-blue-600 hover:underline"
          >
            View full P&amp;L →
          </Link>
        </div>
      </div>
    </div>
  );
}
