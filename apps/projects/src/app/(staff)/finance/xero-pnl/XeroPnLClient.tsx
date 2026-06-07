'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  syncLatestMonth,
  backfillXeroPnL,
  listPnLSnapshots,
  type PnLSnapshotRow,
} from './actions';

type AccountLine = { name: string; amount: number };

// ─── Formatting ───────────────────────────────────────────────────────────────

const AUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 });
const AUD0 = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });

function fmtAUD(v: number) { return AUD.format(v); }
function fmtAUD0(v: number) { return AUD0.format(v); }
function fmtPct(v: number) { return v.toFixed(1) + '%'; }

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
function monthName(m: number) { return MONTH_NAMES[m - 1] ?? String(m); }

function fmtMonthYear(month: number, year: number) { return `${monthName(month)} ${year}`; }

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function num(v: unknown) { return Number(String(v ?? '0')); }

function pct(income: number, gp: number) {
  return income > 0 ? (gp / income) * 100 : 0;
}

function marginColour(p: number): string {
  if (p >= 15) return 'text-emerald-700';
  if (p >= 5) return 'text-amber-600';
  return 'text-red-600';
}

// ─── Financial year helpers ───────────────────────────────────────────────────

function getFYLabel(year: number) { return `FY${String(year + 1).slice(2)}`; }

function snapshotFYStartYear(s: PnLSnapshotRow): number {
  // FY runs Jul-Jun. If month >= 7, FY started this year; else FY started prev year.
  return s.month >= 7 ? s.year : s.year - 1;
}

// ─── Account breakdown section ────────────────────────────────────────────────

function AccountSection({
  title,
  accounts,
  maxShow = 10,
}: {
  title: string;
  accounts: AccountLine[];
  maxShow?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? accounts : accounts.slice(0, maxShow);
  return (
    <div>
      <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">{title}</h4>
      {visible.length === 0 ? (
        <p className="text-xs text-zinc-400">None</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {visible.map((a, i) => (
            <li key={i} className="flex justify-between py-1">
              <span className="text-xs text-zinc-700">{a.name}</span>
              <span className="text-xs font-medium text-zinc-900">{fmtAUD(Math.abs(a.amount))}</span>
            </li>
          ))}
        </ul>
      )}
      {accounts.length > maxShow && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-1 text-xs text-blue-600 hover:underline"
        >
          {showAll ? 'Show less' : `Show ${accounts.length - maxShow} more`}
        </button>
      )}
    </div>
  );
}

// ─── Detail slide-in ──────────────────────────────────────────────────────────

function DetailPanel({
  snapshot,
  onClose,
}: {
  snapshot: PnLSnapshotRow;
  onClose: () => void;
}) {
  const income = (snapshot.incomeAccountsJson as AccountLine[]) ?? [];
  const cos = (snapshot.cosAccountsJson as AccountLine[]) ?? [];
  const expenses = (snapshot.expenseAccountsJson as AccountLine[]) ?? [];
  const otherIncome = (snapshot.otherIncomeJson as AccountLine[]) ?? [];

  const gpPct = pct(num(snapshot.totalIncome), num(snapshot.grossProfit));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <h3 className="font-semibold text-zinc-900">
            {fmtMonthYear(snapshot.month, snapshot.year)}
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Revenue', value: fmtAUD(num(snapshot.totalIncome)) },
              { label: 'Direct Costs', value: fmtAUD(num(snapshot.totalCostOfSales)) },
              { label: 'Gross Profit', value: fmtAUD(num(snapshot.grossProfit)) },
              { label: 'Gross Margin', value: fmtPct(gpPct), colour: marginColour(gpPct) },
              { label: 'Expenses', value: fmtAUD(num(snapshot.totalExpenses)) },
              { label: 'Net Profit', value: fmtAUD(num(snapshot.netProfit)), colour: num(snapshot.netProfit) >= 0 ? 'text-emerald-700' : 'text-red-600' },
            ].map(({ label, value, colour }) => (
              <div key={label} className="bg-zinc-50 rounded-lg p-3">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</div>
                <div className={`text-sm font-semibold mt-0.5 ${colour ?? 'text-zinc-900'}`}>{value}</div>
              </div>
            ))}
          </div>

          <AccountSection title="Income" accounts={income} maxShow={10} />
          <AccountSection title="Direct Costs" accounts={cos} maxShow={5} />
          {otherIncome.length > 0 && (
            <AccountSection title="Other Income" accounts={otherIncome} maxShow={5} />
          )}
          <AccountSection title="Expenses" accounts={expenses} maxShow={10} />

          {snapshot.xeroReportLink && (
            <a
              href={snapshot.xeroReportLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-blue-600 hover:underline"
            >
              View in Xero →
            </a>
          )}
          <p className="text-xs text-zinc-400">
            Synced {fmtDateTime(snapshot.pulledAt)}
          </p>
        </div>
      </div>
    </>
  );
}

// ─── Backfill progress modal ──────────────────────────────────────────────────

function BackfillModal({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: () => void;
}) {
  const [stage, setStage] = useState<'confirm' | 'running' | 'done'>('confirm');
  const [result, setResult] = useState<{ pulled: number; errors: string[] } | null>(null);
  const [isPending, startTransition] = useTransition();

  const now = new Date();
  const toMonth = MONTH_NAMES[(now.getMonth())] ?? '';
  const toYear = now.getFullYear();

  function handleStart() {
    setStage('running');
    startTransition(async () => {
      const res = await backfillXeroPnL();
      setResult({ pulled: res.pulled, errors: res.errors });
      setStage('done');
    });
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
          {stage === 'confirm' && (
            <>
              <h3 className="font-semibold text-zinc-900">Backfill Historical Months</h3>
              <p className="text-sm text-zinc-600">
                This will sync all months from <strong>July 2025</strong> to <strong>{toMonth} {toYear}</strong> from Xero.
                Each month is pulled in sequence — this may take up to 60 seconds.
                Existing data for any month will be overwritten with the latest Xero figures.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 border border-zinc-300 text-zinc-700 text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStart}
                  className="flex-1 bg-zinc-900 text-white text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-zinc-700"
                >
                  Start Backfill
                </button>
              </div>
            </>
          )}
          {stage === 'running' && (
            <>
              <h3 className="font-semibold text-zinc-900">Backfilling…</h3>
              <div className="flex items-center gap-3 text-sm text-zinc-600">
                <svg className="animate-spin w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Pulling months from Xero in sequence. Please wait…
              </div>
            </>
          )}
          {stage === 'done' && result && (
            <>
              <h3 className="font-semibold text-zinc-900">Backfill Complete</h3>
              {result.errors.length === 0 ? (
                <p className="text-sm text-emerald-700">
                  {result.pulled} month{result.pulled !== 1 ? 's' : ''} synced successfully.
                </p>
              ) : (
                <>
                  <p className="text-sm text-zinc-700">
                    {result.pulled} month{result.pulled !== 1 ? 's' : ''} synced.{' '}
                    {result.errors.length} failed:
                  </p>
                  <ul className="text-sm text-red-600 list-disc pl-4 space-y-1">
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </>
              )}
              <button
                onClick={() => { onComplete(); onClose(); }}
                className="w-full bg-zinc-900 text-white text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-zinc-700"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function XeroPnLClient({ initialSnapshots }: { initialSnapshots: PnLSnapshotRow[] }) {
  const router = useRouter();
  const [snapshots, setSnapshots] = useState<PnLSnapshotRow[]>(initialSnapshots);
  const [isPending, startTransition] = useTransition();
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showBackfill, setShowBackfill] = useState(false);
  const [fyFilter, setFyFilter] = useState<number | 'all'>('all');

  const fyYears = useMemo(() => {
    const years = new Set(snapshots.map(snapshotFYStartYear));
    return Array.from(years).sort((a, b) => b - a);
  }, [snapshots]);

  const filtered = useMemo(() => {
    if (fyFilter === 'all') return snapshots;
    return snapshots.filter((s) => snapshotFYStartYear(s) === fyFilter);
  }, [snapshots, fyFilter]);

  // YTD totals for the filtered set
  const totals = useMemo(() => {
    const totalIncome = filtered.reduce((s, r) => s + num(r.totalIncome), 0);
    const totalCostOfSales = filtered.reduce((s, r) => s + num(r.totalCostOfSales), 0);
    const grossProfit = filtered.reduce((s, r) => s + num(r.grossProfit), 0);
    const totalExpenses = filtered.reduce((s, r) => s + num(r.totalExpenses), 0);
    const netProfit = filtered.reduce((s, r) => s + num(r.netProfit), 0);
    const gpPct = totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0;
    return { totalIncome, totalCostOfSales, grossProfit, gpPct, totalExpenses, netProfit };
  }, [filtered]);

  const selectedSnap = snapshots.find((s) => s.id === selectedId) ?? null;

  async function refreshData() {
    const fresh = await listPnLSnapshots();
    setSnapshots(fresh);
    router.refresh();
  }

  function handleSync() {
    setSyncError(null);
    setSyncSuccess(false);
    startTransition(async () => {
      const result = await syncLatestMonth();
      if (result.ok) {
        setSyncSuccess(true);
        await refreshData();
      } else {
        setSyncError(result.error ?? 'Sync failed.');
      }
    });
  }

  const fyLabel = fyFilter === 'all' ? 'All Years' : getFYLabel(fyFilter);

  return (
    <div className="p-6 max-w-6xl space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-zinc-900">P&amp;L History</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSync}
            disabled={isPending}
            className="bg-zinc-900 text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-zinc-700 disabled:opacity-50"
          >
            {isPending ? 'Syncing…' : 'Sync Latest Month'}
          </button>
          <button
            onClick={() => setShowBackfill(true)}
            className="border border-zinc-300 text-zinc-700 text-sm font-medium rounded-lg px-4 py-2 hover:bg-zinc-50"
          >
            Backfill Historical Months
          </button>
        </div>
      </div>

      {/* Status messages */}
      {syncError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {syncError}
        </p>
      )}
      {syncSuccess && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
          Month synced successfully.
        </p>
      )}

      {/* Filters */}
      <div className="flex gap-2 items-center">
        <label className="text-xs text-zinc-500 font-medium">Financial Year</label>
        <select
          value={fyFilter}
          onChange={(e) => setFyFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="text-sm border border-zinc-300 rounded-md px-2 py-1 bg-white"
        >
          <option value="all">All Years</option>
          {fyYears.map((y) => (
            <option key={y} value={y}>{getFYLabel(y)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Month</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Revenue</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Direct Costs</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Gross Profit</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Margin</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Expenses</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Net Profit</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Synced</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filtered.map((row) => {
              const income = num(row.totalIncome);
              const gp = num(row.grossProfit);
              const np = num(row.netProfit);
              const margin = pct(income, gp);
              return (
                <tr
                  key={row.id}
                  className="hover:bg-zinc-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedId(row.id === selectedId ? null : row.id)}
                >
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {fmtMonthYear(row.month, row.year)}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-700">{fmtAUD0(income)}</td>
                  <td className="px-4 py-3 text-right text-zinc-700">{fmtAUD0(num(row.totalCostOfSales))}</td>
                  <td className="px-4 py-3 text-right text-zinc-700">{fmtAUD0(gp)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${marginColour(margin)}`}>
                    {fmtPct(margin)}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-700">{fmtAUD0(num(row.totalExpenses))}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${np >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {fmtAUD(np)}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{fmtDateTime(row.pulledAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedId(row.id === selectedId ? null : row.id); }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View detail
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-zinc-400 text-sm">
                  No months synced yet. Click &quot;Sync Latest Month&quot; or &quot;Backfill Historical Months&quot; to get started.
                </td>
              </tr>
            )}
          </tbody>
          {/* YTD footer */}
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-zinc-300 bg-zinc-50 font-semibold">
                <td className="px-4 py-3 text-xs text-zinc-600 uppercase tracking-wide">
                  {fyLabel} Total
                </td>
                <td className="px-4 py-3 text-right text-zinc-900">{fmtAUD(totals.totalIncome)}</td>
                <td className="px-4 py-3 text-right text-zinc-900">{fmtAUD(totals.totalCostOfSales)}</td>
                <td className="px-4 py-3 text-right text-zinc-900">{fmtAUD(totals.grossProfit)}</td>
                <td className={`px-4 py-3 text-right ${marginColour(totals.gpPct)}`}>
                  {fmtPct(totals.gpPct)}
                </td>
                <td className="px-4 py-3 text-right text-zinc-900">{fmtAUD(totals.totalExpenses)}</td>
                <td className={`px-4 py-3 text-right ${totals.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {fmtAUD(totals.netProfit)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Detail slide-in */}
      {selectedSnap && (
        <DetailPanel snapshot={selectedSnap} onClose={() => setSelectedId(null)} />
      )}

      {/* Backfill modal */}
      {showBackfill && (
        <BackfillModal
          onClose={() => setShowBackfill(false)}
          onComplete={() => refreshData()}
        />
      )}
    </div>
  );
}
