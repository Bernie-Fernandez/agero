'use client';
import { useState, useTransition } from 'react';
import { showToast, ToastContainer } from '@/components/Toast';
import { createSnapshot } from '../actions';

type Line = {
  total: number | string;
  isRisk: boolean;
  isOption: boolean;
  isPcSum: boolean;
  isLockaway: boolean;
  isHidden: boolean;
  tradeSectionId: string | null;
};

type TradeSection = { id: string; name: string; code: string | null };

type Snapshot = {
  id: string;
  label: string;
  snapshotData: Record<string, unknown>;
  createdAt: Date | string;
  createdBy: { firstName: string; lastName: string };
};

type Estimate = {
  id: string;
  title: string;
  targetGpPct: number | string;
  minGpPct: number | string;
  defaultMarkupPct: number | string;
  costRecoveryPct: number | string;
  budgetCoverageTarget: number | string;
  lines: Line[];
  tradeSections: TradeSection[];
  snapshots: Snapshot[];
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);
}

function pct(n: number) { return `${n.toFixed(2)}%`; }

function gpColor(gp: number, target: number, min: number) {
  if (gp >= target) return 'text-green-600';
  if (gp >= min) return 'text-amber-600';
  return 'text-red-600';
}

export default function DashboardClient({ estimate }: { estimate: Estimate }) {
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [pending, startTransition] = useTransition();

  const lines = estimate.lines;
  const totalCost = lines
    .filter((l) => !l.isOption && !l.isLockaway)
    .reduce((s, l) => s + Number(l.total), 0);
  const riskCost = lines.filter((l) => l.isRisk).reduce((s, l) => s + Number(l.total), 0);
  const optionCost = lines.filter((l) => l.isOption).reduce((s, l) => s + Number(l.total), 0);
  const lockawayCost = lines.filter((l) => l.isLockaway).reduce((s, l) => s + Number(l.total), 0);
  const pcSumCost = lines.filter((l) => l.isPcSum).reduce((s, l) => s + Number(l.total), 0);

  const markup = Number(estimate.defaultMarkupPct) / 100;
  const costRecovery = Number(estimate.costRecoveryPct) / 100;
  const grossRevenue = totalCost * (1 + markup) * (1 + costRecovery);
  const gpAmount = grossRevenue - totalCost;
  const gpPct = grossRevenue > 0 ? (gpAmount / grossRevenue) * 100 : 0;
  const targetGp = Number(estimate.targetGpPct);
  const minGp = Number(estimate.minGpPct);
  const budgetTarget = Number(estimate.budgetCoverageTarget);
  const coveredLines = lines.filter((l) => Number(l.total) > 0 && !l.isOption && !l.isLockaway).length;
  const allLines = lines.filter((l) => !l.isOption && !l.isLockaway).length;
  const budgetCoverage = allLines > 0 ? (coveredLines / allLines) * 100 : 0;

  // Section breakdown
  const sectionMap: Record<string, number> = {};
  for (const line of lines.filter((l) => !l.isOption && !l.isLockaway)) {
    const key = line.tradeSectionId ?? 'unassigned';
    sectionMap[key] = (sectionMap[key] ?? 0) + Number(line.total);
  }

  const kpis = [
    { label: 'Total Cost', value: fmt(totalCost), sub: null },
    { label: 'Gross Revenue', value: fmt(grossRevenue), sub: null },
    { label: 'GP Amount', value: fmt(gpAmount), sub: null },
    { label: 'GP %', value: pct(gpPct), sub: `Target: ${pct(targetGp)}`, color: gpColor(gpPct, targetGp, minGp) },
    { label: 'Risk & Opps', value: fmt(riskCost), sub: null },
    { label: 'Options', value: fmt(optionCost), sub: null },
    { label: 'Lockaway', value: fmt(lockawayCost), sub: null },
    { label: 'PC Sums', value: fmt(pcSumCost), sub: null },
    { label: 'Budget Coverage', value: pct(budgetCoverage), sub: `Target: ${pct(budgetTarget)}`, color: budgetCoverage >= budgetTarget ? 'text-green-600' : 'text-amber-600' },
  ];

  function handleSnapshot() {
    if (!snapshotLabel.trim()) return;
    startTransition(async () => {
      await createSnapshot(estimate.id, snapshotLabel.trim());
      setSnapshotLabel('');
      showToast('Snapshot saved');
    });
  }

  return (
    <div className="h-full overflow-auto bg-zinc-50 p-6 space-y-6">
      <ToastContainer />

      {/* KPI grid */}
      <div className="grid grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-lg border border-zinc-200 p-4">
            <p className="text-xs text-zinc-500 font-medium mb-1">{kpi.label}</p>
            <p className={`text-xl font-bold ${kpi.color ?? 'text-zinc-900'}`}>{kpi.value}</p>
            {kpi.sub && <p className="text-xs text-zinc-400 mt-0.5">{kpi.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Section breakdown */}
        <div className="bg-white rounded-lg border border-zinc-200 p-5">
          <h2 className="text-sm font-semibold text-zinc-800 mb-4">Cost by Trade Section</h2>
          {estimate.tradeSections.length === 0 ? (
            <p className="text-sm text-zinc-400">No trade sections yet.</p>
          ) : (
            <div className="space-y-2">
              {estimate.tradeSections.map((section) => {
                const cost = sectionMap[section.id] ?? 0;
                const pctOfTotal = totalCost > 0 ? (cost / totalCost) * 100 : 0;
                return (
                  <div key={section.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-zinc-700 truncate flex-1">{section.code && <span className="text-zinc-400 mr-1.5">{section.code}</span>}{section.name}</span>
                      <span className="text-zinc-600 font-medium ml-4 shrink-0">{fmt(cost)}</span>
                      <span className="text-zinc-400 text-xs ml-2 w-10 text-right shrink-0">{pctOfTotal.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-zinc-100 rounded-full h-1.5">
                      <div className="bg-brand rounded-full h-1.5" style={{ width: `${pctOfTotal}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Snapshot / Changes Log */}
        <div className="bg-white rounded-lg border border-zinc-200 p-5">
          <h2 className="text-sm font-semibold text-zinc-800 mb-4">Changes Log</h2>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Snapshot label…"
              value={snapshotLabel}
              onChange={(e) => setSnapshotLabel(e.target.value)}
              className="flex-1 border border-zinc-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              onKeyDown={(e) => e.key === 'Enter' && handleSnapshot()}
            />
            <button
              onClick={handleSnapshot}
              disabled={pending || !snapshotLabel.trim()}
              className="px-3 py-1.5 text-sm bg-brand text-white rounded-md hover:bg-brand/90 disabled:opacity-50"
            >
              Save
            </button>
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {estimate.snapshots.length === 0 ? (
              <p className="text-sm text-zinc-400">No snapshots yet.</p>
            ) : (
              estimate.snapshots.map((snap) => {
                const data = snap.snapshotData as Record<string, string>;
                return (
                  <div key={snap.id} className="flex items-start justify-between py-2 border-b border-zinc-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-zinc-800">{snap.label}</p>
                      <p className="text-xs text-zinc-400">
                        {new Date(snap.createdAt).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })} · {snap.createdBy.firstName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-zinc-700">{data.totalCost ? fmt(Number(data.totalCost)) : '—'}</p>
                      <p className="text-xs text-zinc-400">{data.lineCount ?? 0} lines</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
