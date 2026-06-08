'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  getProjectRevenueBudgets,
  getUnsecuredRevenueBudgets,
  getQualifyingLeads,
  upsertProjectRevenueBudget,
  upsertUnsecuredRevenueBudget,
  addUnsecuredLead,
  removeUnsecuredRevenueBudget,
  type ProjectRevenueBudgetRow,
  type UnsecuredRevenueBudgetRow,
  type QualifyingLead,
} from '@/lib/revenue-budget/actions';
import {
  MONTH_KEYS_FY27,
  MONTH_KEYS_FY28,
  ALL_MONTH_KEYS,
  MONTH_LABELS,
  type MonthKey,
  type MonthlyData,
} from '@/lib/revenue-budget/constants';

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  DEVELOPING: 'Stage 2',
  QUALIFIED: 'Stage 3',
  SUBMISSION_IN_PROGRESS: 'Stage 4',
  SUBMISSION_AWAITING: 'Stage 5',
  INTENT_TO_NEGOTIATE: 'Stage 6',
};

const AUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 2 });
function fmtAUD(v: number | string) { return AUD.format(Number(v)); }

function round2dp(n: number): number {
  return Math.round(n * 100) / 100;
}

function rowSum(monthly: Record<MonthKey, string>, keys: readonly MonthKey[]): number {
  return keys.reduce((s, k) => s + Number(monthly[k] ?? 0), 0);
}

function allMonthSum(monthly: Record<MonthKey, string>): number {
  return ALL_MONTH_KEYS.reduce((s, k) => s + Number(monthly[k] ?? 0), 0);
}

// ─── Lock icon ────────────────────────────────────────────────────────────────

function LockSVG() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
      <path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V6H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-.5V4.5A3.5 3.5 0 0 0 8 1Zm2 5V4.5a2 2 0 1 0-4 0V6h4Z" clipRule="evenodd" />
    </svg>
  );
}

// ─── Distribute Popover ───────────────────────────────────────────────────────

function DistributePopover({
  defaultTotal,
  visibleMonths,
  lockedKeys,
  currentMonthly,
  onApply,
  onClose,
}: {
  defaultTotal: number;
  visibleMonths: readonly MonthKey[];
  lockedKeys: Record<MonthKey, boolean>;
  currentMonthly: Record<MonthKey, string>;
  onApply: (data: MonthlyData) => void;
  onClose: () => void;
}) {
  const [total, setTotal] = useState(defaultTotal.toFixed(2));
  const [fromMonth, setFromMonth] = useState<MonthKey>(visibleMonths[0]);
  const [toMonth, setToMonth] = useState<MonthKey>(visibleMonths[visibleMonths.length - 1]);

  const hasLocked = Object.values(lockedKeys).some(Boolean);

  function handleApply() {
    const fromIdx = visibleMonths.indexOf(fromMonth);
    const toIdx = visibleMonths.indexOf(toMonth);
    if (fromIdx < 0 || toIdx < fromIdx) return;
    const range = visibleMonths.slice(fromIdx, toIdx + 1);

    const unlockedInRange = range.filter((k) => !lockedKeys[k]);
    const lockedInRange = range.filter((k) => lockedKeys[k]);

    const lockedSum = lockedInRange.reduce((s, k) => s + Number(currentMonthly[k] ?? 0), 0);
    const distributeAmount = Number(total) - lockedSum;

    const data: MonthlyData = {};
    if (unlockedInRange.length === 0) {
      onClose();
      return;
    }

    const perCell = round2dp(distributeAmount / unlockedInRange.length);
    const lastKey = unlockedInRange[unlockedInRange.length - 1];
    const lastCell = round2dp(distributeAmount - (unlockedInRange.length - 1) * perCell);

    for (const key of visibleMonths) {
      if (lockedKeys[key]) {
        // Locked cells always keep their current value
        data[key] = Number(currentMonthly[key] ?? 0);
      } else if (!range.includes(key)) {
        // Unlocked, outside distribute range → zero
        data[key] = 0;
      } else if (key === lastKey) {
        // Last unlocked cell gets remainder to ensure exact sum
        data[key] = lastCell;
      } else {
        data[key] = perCell;
      }
    }

    onApply(data);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl border border-zinc-200 p-4 w-72">
        <h3 className="text-sm font-semibold text-zinc-800 mb-3">Distribute revenue evenly</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Total amount ($)</label>
            <input
              type="number" min="0" step="0.01"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              className="w-full text-sm border border-zinc-300 rounded px-2 py-1.5"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">From month</label>
            <select
              value={fromMonth}
              onChange={(e) => setFromMonth(e.target.value as MonthKey)}
              className="w-full text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
            >
              {visibleMonths.map((m) => (
                <option key={m} value={m}>{MONTH_LABELS[m]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">To month</label>
            <select
              value={toMonth}
              onChange={(e) => setToMonth(e.target.value as MonthKey)}
              className="w-full text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white"
            >
              {visibleMonths.map((m) => (
                <option key={m} value={m}>{MONTH_LABELS[m]}</option>
              ))}
            </select>
          </div>
          {hasLocked && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Locked cells are excluded from distribution.
            </p>
          )}
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="text-xs text-zinc-600 border border-zinc-300 rounded px-3 py-1.5 hover:bg-zinc-50">
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="text-xs bg-blue-600 text-white rounded px-3 py-1.5 hover:bg-blue-700"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Project Spread Row (Sections A & B) ─────────────────────────────────────
// Columns: Job No | Project | Contract (budget) | Distribute | FY Total | months | (empty)

function ProjectSpreadRow({
  row,
  monthly,
  visibleMonths,
  locked,
  onCellChange,
  onCellSave,
  onDistribute,
  onClear,
  onToggleLock,
}: {
  row: ProjectRevenueBudgetRow;
  monthly: Record<MonthKey, string>;
  visibleMonths: readonly MonthKey[];
  locked: Record<MonthKey, boolean>;
  onCellChange: (fpId: string, key: MonthKey, value: string) => void;
  onCellSave: (fpId: string, key: MonthKey, value: string) => Promise<void>;
  onDistribute: (fpId: string) => void;
  onClear: (fpId: string) => void;
  onToggleLock: (fpId: string, key: MonthKey) => void;
}) {
  const [saved, setSaved] = useState(false);
  const fullTotal = allMonthSum(monthly);
  const visibleTotal = rowSum(monthly, visibleMonths);
  const budgetRevenue = row.budgetRevenue != null ? Number(row.budgetRevenue) : null;

  // Pre-fill FY Total with budgetRevenue when no months have been entered yet
  const isBudgetTarget = fullTotal === 0 && budgetRevenue != null;
  const displayTotal = isBudgetTarget ? budgetRevenue! : visibleTotal;

  const showVariance = row.classification === 'BACKLOG' && budgetRevenue != null && !isBudgetTarget;
  const variance = showVariance ? fullTotal - budgetRevenue! : 0;
  const hasVariance = showVariance && Math.abs(variance) > 0.5;

  async function handleBlur(key: MonthKey, rawValue: string) {
    const numStr = String(Number(rawValue) || 0);
    onCellChange(row.financeProjectId, key, numStr);
    await onCellSave(row.financeProjectId, key, numStr);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <>
      <tr className="border-b text-sm hover:bg-zinc-50">
        <td className="px-3 py-1.5 text-zinc-500 text-xs whitespace-nowrap font-mono">{row.jobNumber}</td>
        <td className="px-3 py-1.5 text-zinc-900 max-w-[180px] truncate">{row.projectName}</td>
        <td className="px-3 py-1.5 text-right text-xs text-zinc-400 whitespace-nowrap">
          {budgetRevenue != null ? fmtAUD(budgetRevenue) : '—'}
        </td>
        <td className="px-2 py-1.5 text-center">
          <div className="flex flex-col items-center gap-0.5">
            <button
              onClick={() => onDistribute(row.financeProjectId)}
              className="text-xs text-blue-600 hover:underline whitespace-nowrap"
            >
              Distribute
            </button>
            <button
              onClick={() => onClear(row.financeProjectId)}
              className="text-xs text-zinc-400 hover:text-zinc-600 hover:underline whitespace-nowrap"
            >
              Clear
            </button>
          </div>
        </td>
        <td className={`px-3 py-1.5 text-right text-xs font-medium whitespace-nowrap ${isBudgetTarget ? 'text-amber-500' : 'text-zinc-700'}`}>
          {fmtAUD(displayTotal)}
          {saved && <span className="ml-1 text-emerald-600">✓</span>}
        </td>
        {visibleMonths.map((key) => (
          <td key={key} className="px-1 py-1">
            <div className="flex items-center gap-0.5">
              <input
                type="number" min="0" step="0.01"
                value={monthly[key] ?? '0'}
                disabled={locked[key]}
                onChange={(e) => onCellChange(row.financeProjectId, key, e.target.value)}
                onBlur={(e) => handleBlur(key, e.target.value)}
                className={`w-16 text-right text-xs border rounded px-1 py-0.5 focus:outline-none focus:border-blue-400 ${
                  locked[key]
                    ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed'
                    : 'border-zinc-200'
                }`}
              />
              <button
                onClick={() => onToggleLock(row.financeProjectId, key)}
                className={`flex-shrink-0 transition-colors ${locked[key] ? 'text-zinc-600' : 'text-zinc-200 hover:text-zinc-400'}`}
                title={locked[key] ? 'Unlock cell' : 'Lock cell'}
              >
                <LockSVG />
              </button>
            </div>
          </td>
        ))}
        <td className="px-2 py-1.5" />
      </tr>
      {hasVariance && (
        <tr>
          <td colSpan={6 + visibleMonths.length} className="px-3 pb-1.5">
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Monthly spread ({fmtAUD(fullTotal)}) does not match budget total ({fmtAUD(budgetRevenue!)}). Difference: {fmtAUD(variance)}.
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Unsecured Spread Row (Section C) ────────────────────────────────────────
// Columns: (—) | Lead + Stage | Contract (leadValue) | Distribute | FY Total | months | ×

function UnsecuredSpreadRow({
  row,
  monthly,
  visibleMonths,
  locked,
  onCellChange,
  onCellSave,
  onDistribute,
  onClear,
  onRemove,
  onToggleLock,
}: {
  row: UnsecuredRevenueBudgetRow;
  monthly: Record<MonthKey, string>;
  visibleMonths: readonly MonthKey[];
  locked: Record<MonthKey, boolean>;
  onCellChange: (leadId: string, key: MonthKey, value: string) => void;
  onCellSave: (leadId: string, key: MonthKey, value: string) => Promise<void>;
  onDistribute: (leadId: string) => void;
  onClear: (leadId: string) => void;
  onRemove: (leadId: string) => void;
  onToggleLock: (leadId: string, key: MonthKey) => void;
}) {
  const [saved, setSaved] = useState(false);
  const rowTotal = rowSum(monthly, visibleMonths);

  async function handleBlur(key: MonthKey, rawValue: string) {
    const numStr = String(Number(rawValue) || 0);
    onCellChange(row.leadId, key, numStr);
    await onCellSave(row.leadId, key, numStr);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <tr className="border-b text-sm hover:bg-zinc-50">
      <td className="px-3 py-1.5 text-zinc-300 text-xs font-mono">—</td>
      <td className="px-3 py-1.5 max-w-[180px]">
        <span className="text-zinc-900 block truncate">{row.leadName}</span>
        <span className="text-zinc-400 text-xs">{STAGE_LABELS[row.stage] ?? row.stage}</span>
      </td>
      <td className="px-3 py-1.5 text-right text-xs text-zinc-500 whitespace-nowrap">{fmtAUD(row.leadValue)}</td>
      <td className="px-2 py-1.5 text-center">
        <div className="flex flex-col items-center gap-0.5">
          <button onClick={() => onDistribute(row.leadId)} className="text-xs text-blue-600 hover:underline whitespace-nowrap">
            Distribute
          </button>
          <button onClick={() => onClear(row.leadId)} className="text-xs text-zinc-400 hover:text-zinc-600 hover:underline whitespace-nowrap">
            Clear
          </button>
        </div>
      </td>
      <td className="px-3 py-1.5 text-right text-xs font-medium text-zinc-700 whitespace-nowrap">
        {fmtAUD(rowTotal)}
        {saved && <span className="ml-1 text-emerald-600">✓</span>}
      </td>
      {visibleMonths.map((key) => (
        <td key={key} className="px-1 py-1">
          <div className="flex items-center gap-0.5">
            <input
              type="number" min="0" step="0.01"
              value={monthly[key] ?? '0'}
              disabled={locked[key]}
              onChange={(e) => onCellChange(row.leadId, key, e.target.value)}
              onBlur={(e) => handleBlur(key, e.target.value)}
              className={`w-16 text-right text-xs border rounded px-1 py-0.5 focus:outline-none focus:border-blue-400 ${
                locked[key]
                  ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed'
                  : 'border-zinc-200'
              }`}
            />
            <button
              onClick={() => onToggleLock(row.leadId, key)}
              className={`flex-shrink-0 transition-colors ${locked[key] ? 'text-zinc-600' : 'text-zinc-200 hover:text-zinc-400'}`}
              title={locked[key] ? 'Unlock cell' : 'Lock cell'}
            >
              <LockSVG />
            </button>
          </div>
        </td>
      ))}
      <td className="px-2 py-1.5 text-center">
        <button
          onClick={() => onRemove(row.leadId)}
          className="text-xs text-red-500 hover:text-red-700"
          title="Remove from budget"
        >
          ×
        </button>
      </td>
    </tr>
  );
}

// ─── Main SpreadView ──────────────────────────────────────────────────────────

export default function SpreadView({ currentFY }: { currentFY: string }) {
  const [projectBudgets, setProjectBudgets] = useState<ProjectRevenueBudgetRow[]>([]);
  const [projectMonthly, setProjectMonthly] = useState<Record<string, Record<MonthKey, string>>>({});
  const [unsecuredBudgets, setUnsecuredBudgets] = useState<UnsecuredRevenueBudgetRow[]>([]);
  const [unsecuredMonthly, setUnsecuredMonthly] = useState<Record<string, Record<MonthKey, string>>>({});
  const [qualLeads, setQualLeads] = useState<QualifyingLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFY28, setShowFY28] = useState(false);
  const [distributingFor, setDistributingFor] = useState<{ id: string; type: 'project' | 'unsecured' } | null>(null);
  const [showAddLead, setShowAddLead] = useState(false);
  const [addingLeadId, setAddingLeadId] = useState<string | null>(null);
  const [lockedCells, setLockedCells] = useState<Record<string, Record<MonthKey, boolean>>>({});

  const isFY27 = currentFY === 'FY27';
  const primaryMonths: readonly MonthKey[] = isFY27 ? MONTH_KEYS_FY27 : MONTH_KEYS_FY28;
  const visibleMonths: readonly MonthKey[] = isFY27 && showFY28 ? ALL_MONTH_KEYS : primaryMonths;

  async function loadData(fy: string) {
    setLoading(true);
    setError(null);
    const [projRes, unsecRes, leadsRes] = await Promise.all([
      getProjectRevenueBudgets(fy),
      getUnsecuredRevenueBudgets(fy),
      getQualifyingLeads(fy),
    ]);
    if (projRes.ok) {
      const budgets = projRes.rows ?? [];
      setProjectBudgets(budgets);
      const monthly: Record<string, Record<MonthKey, string>> = {};
      for (const row of budgets) monthly[row.financeProjectId] = { ...row.monthly };
      setProjectMonthly(monthly);
    } else {
      setError(projRes.error ?? 'Failed to load project budgets.');
    }
    if (unsecRes.ok) {
      const rows = unsecRes.rows ?? [];
      setUnsecuredBudgets(rows);
      const monthly: Record<string, Record<MonthKey, string>> = {};
      for (const row of rows) monthly[row.leadId] = { ...row.monthly };
      setUnsecuredMonthly(monthly);
    }
    if (leadsRes.ok) setQualLeads(leadsRes.leads ?? []);
    setLoading(false);
  }

  useEffect(() => { loadData(currentFY); }, [currentFY]);

  // ─── Cell handlers ─────────────────────────────────────────────────────────

  function handleProjectCellChange(fpId: string, key: MonthKey, value: string) {
    setProjectMonthly((prev) => ({
      ...prev,
      [fpId]: { ...(prev[fpId] ?? {}), [key]: value } as Record<MonthKey, string>,
    }));
  }

  async function handleProjectCellSave(fpId: string, key: MonthKey, value: string) {
    const row = projectBudgets.find((r) => r.financeProjectId === fpId);
    if (!row) return;
    const current = projectMonthly[fpId] ?? {};
    await upsertProjectRevenueBudget({
      financeProjectId: fpId,
      fyYear: currentFY,
      classification: row.classification,
      monthlyData: { [key]: Number(value) },
    });
    setProjectBudgets((prev) => prev.map((r) =>
      r.financeProjectId === fpId ? { ...r, id: r.id || fpId } : r
    ));
    void current;
  }

  function handleUnsecuredCellChange(leadId: string, key: MonthKey, value: string) {
    setUnsecuredMonthly((prev) => ({
      ...prev,
      [leadId]: { ...(prev[leadId] ?? {}), [key]: value } as Record<MonthKey, string>,
    }));
  }

  async function handleUnsecuredCellSave(leadId: string, key: MonthKey, value: string) {
    const row = unsecuredBudgets.find((r) => r.leadId === leadId);
    if (!row) return;
    await upsertUnsecuredRevenueBudget({
      leadId,
      leadName: row.leadName,
      leadValue: Number(row.leadValue),
      fyYear: currentFY,
      monthlyData: { [key]: Number(value) },
    });
  }

  // ─── Clear handlers ────────────────────────────────────────────────────────

  async function handleProjectClear(fpId: string) {
    const row = projectBudgets.find((r) => r.financeProjectId === fpId);
    if (!row) return;
    const locked = (lockedCells[fpId] ?? {}) as Record<MonthKey, boolean>;
    const monthlyData: MonthlyData = {};
    const updatedMonthly = { ...(projectMonthly[fpId] ?? {}) } as Record<MonthKey, string>;
    for (const key of ALL_MONTH_KEYS) {
      if (!locked[key]) { monthlyData[key] = 0; updatedMonthly[key] = '0'; }
    }
    setProjectMonthly((prev) => ({ ...prev, [fpId]: updatedMonthly }));
    await upsertProjectRevenueBudget({
      financeProjectId: fpId,
      fyYear: currentFY,
      classification: row.classification,
      monthlyData,
    });
  }

  async function handleUnsecuredClear(leadId: string) {
    const row = unsecuredBudgets.find((r) => r.leadId === leadId);
    if (!row) return;
    const locked = (lockedCells[leadId] ?? {}) as Record<MonthKey, boolean>;
    const monthlyData: MonthlyData = {};
    const updatedMonthly = { ...(unsecuredMonthly[leadId] ?? {}) } as Record<MonthKey, string>;
    for (const key of ALL_MONTH_KEYS) {
      if (!locked[key]) { monthlyData[key] = 0; updatedMonthly[key] = '0'; }
    }
    setUnsecuredMonthly((prev) => ({ ...prev, [leadId]: updatedMonthly }));
    await upsertUnsecuredRevenueBudget({
      leadId,
      leadName: row.leadName,
      leadValue: Number(row.leadValue),
      fyYear: currentFY,
      monthlyData,
    });
  }

  // ─── Lock handlers ─────────────────────────────────────────────────────────

  function handleToggleLock(entityId: string, key: MonthKey) {
    setLockedCells((prev) => ({
      ...prev,
      [entityId]: {
        ...(prev[entityId] ?? {}),
        [key]: !prev[entityId]?.[key],
      } as Record<MonthKey, boolean>,
    }));
  }

  // ─── Distribute ────────────────────────────────────────────────────────────

  async function handleDistributeApply(data: MonthlyData) {
    if (!distributingFor) return;
    if (distributingFor.type === 'project') {
      const row = projectBudgets.find((r) => r.financeProjectId === distributingFor.id);
      if (!row) return;
      setProjectMonthly((prev) => {
        const updated = { ...(prev[distributingFor.id] ?? {}) } as Record<MonthKey, string>;
        for (const [k, v] of Object.entries(data)) updated[k as MonthKey] = String(v);
        return { ...prev, [distributingFor.id]: updated };
      });
      await upsertProjectRevenueBudget({
        financeProjectId: distributingFor.id,
        fyYear: currentFY,
        classification: row.classification,
        monthlyData: data,
        distributed: true,
      });
    } else {
      const row = unsecuredBudgets.find((r) => r.leadId === distributingFor.id);
      if (!row) return;
      setUnsecuredMonthly((prev) => {
        const updated = { ...(prev[distributingFor.id] ?? {}) } as Record<MonthKey, string>;
        for (const [k, v] of Object.entries(data)) updated[k as MonthKey] = String(v);
        return { ...prev, [distributingFor.id]: updated };
      });
      await upsertUnsecuredRevenueBudget({
        leadId: distributingFor.id,
        leadName: row.leadName,
        leadValue: Number(row.leadValue),
        fyYear: currentFY,
        monthlyData: data,
        distributed: true,
      });
    }
  }

  // ─── Unsecured add/remove ──────────────────────────────────────────────────

  async function handleAddLead(leadId: string) {
    setAddingLeadId(leadId);
    const res = await addUnsecuredLead({ leadId, fyYear: currentFY });
    if (res.ok) await loadData(currentFY);
    setAddingLeadId(null);
    setShowAddLead(false);
  }

  async function handleRemoveLead(leadId: string) {
    const res = await removeUnsecuredRevenueBudget({ leadId, fyYear: currentFY });
    if (res.ok) {
      setUnsecuredBudgets((prev) => prev.filter((r) => r.leadId !== leadId));
      setUnsecuredMonthly((prev) => { const next = { ...prev }; delete next[leadId]; return next; });
      setLockedCells((prev) => { const next = { ...prev }; delete next[leadId]; return next; });
      setQualLeads((prev) => {
        const row = unsecuredBudgets.find((r) => r.leadId === leadId);
        if (!row) return prev;
        return [...prev, { id: row.leadId, leadName: row.leadName, contractValue: row.leadValue, stage: row.stage }];
      });
    }
  }

  // ─── Totals ────────────────────────────────────────────────────────────────

  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const key of ALL_MONTH_KEYS) totals[key] = 0;

    for (const [fpId, monthly] of Object.entries(projectMonthly)) {
      const budget = projectBudgets.find((r) => r.financeProjectId === fpId);
      if (budget?.classification === 'IGNORE') continue;
      for (const key of ALL_MONTH_KEYS) totals[key] += Number(monthly[key] ?? 0);
    }
    for (const monthly of Object.values(unsecuredMonthly)) {
      for (const key of ALL_MONTH_KEYS) totals[key] += Number(monthly[key] ?? 0);
    }
    return totals;
  }, [projectMonthly, unsecuredMonthly, projectBudgets]);

  // ─── Derived sections ──────────────────────────────────────────────────────

  const awardedBudgets = projectBudgets.filter((r) => r.classification === 'AWARDED');
  const backlogBudgets = projectBudgets.filter((r) => r.classification === 'BACKLOG');

  // ─── Distribute helpers ────────────────────────────────────────────────────

  function getDistributeDefault(): number {
    if (!distributingFor) return 0;
    if (distributingFor.type === 'project') {
      const row = projectBudgets.find((r) => r.financeProjectId === distributingFor.id);
      return row?.budgetRevenue != null ? Number(row.budgetRevenue) : 0;
    } else {
      const row = unsecuredBudgets.find((r) => r.leadId === distributingFor.id);
      return row ? Number(row.leadValue) : 0;
    }
  }

  function getDistributeLocked(): Record<MonthKey, boolean> {
    if (!distributingFor) return {} as Record<MonthKey, boolean>;
    return (lockedCells[distributingFor.id] ?? {}) as Record<MonthKey, boolean>;
  }

  function getDistributeMonthly(): Record<MonthKey, string> {
    if (!distributingFor) return {} as Record<MonthKey, string>;
    if (distributingFor.type === 'project') {
      return (projectMonthly[distributingFor.id] ?? {}) as Record<MonthKey, string>;
    }
    return (unsecuredMonthly[distributingFor.id] ?? {}) as Record<MonthKey, string>;
  }

  // ─── Section header ────────────────────────────────────────────────────────

  function SectionHeader({ label, cols }: { label: string; cols: number }) {
    return (
      <tr className="bg-zinc-100">
        <td colSpan={cols} className="px-3 py-2 text-xs font-semibold text-zinc-600 uppercase tracking-wide">
          {label}
        </td>
      </tr>
    );
  }

  // Job No + Project/Lead + Contract + Distribute + FY Total + months + Actions
  const totalVisibleCols = 6 + visibleMonths.length;

  if (loading) {
    return <div className="py-8 text-center text-sm text-zinc-400">Loading spread data…</div>;
  }

  if (error) {
    return <div className="py-8 text-center text-sm text-red-500">{error}</div>;
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 text-sm text-zinc-600">
          <span className="font-medium">Revenue Spread — {currentFY}</span>
          {isFY27 && (
            <button
              onClick={() => setShowFY28(!showFY28)}
              className={`text-xs px-3 py-1 rounded border transition-colors ${
                showFY28
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              {showFY28 ? 'Hide FY28 columns' : 'Show FY28 columns'}
            </button>
          )}
        </div>
      </div>

      {/* Scrollable grid */}
      <div className="overflow-x-auto border border-zinc-200 rounded bg-white">
        <table className="text-sm border-collapse" style={{ minWidth: `${520 + visibleMonths.length * 96}px` }}>
          {/* Column headers */}
          <thead className="bg-zinc-50 border-b">
            <tr className="text-xs text-zinc-500">
              <th className="px-3 py-2 text-left w-20">Job No</th>
              <th className="px-3 py-2 text-left w-44">Project / Lead</th>
              <th className="px-3 py-2 text-right w-28">Contract</th>
              <th className="px-3 py-2 text-center w-24">Dist.</th>
              <th className="px-3 py-2 text-right w-28">FY Total</th>
              {visibleMonths.map((key) => (
                <th key={key} className="px-1 py-2 w-24 text-center">{MONTH_LABELS[key]}</th>
              ))}
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {/* ── Section A: Awarded ────────────────────────────────── */}
            <SectionHeader label="A — Awarded" cols={totalVisibleCols} />
            {awardedBudgets.length === 0 ? (
              <tr>
                <td colSpan={totalVisibleCols} className="px-3 py-3 text-xs text-zinc-400 text-center">
                  No awarded projects for {currentFY}.
                </td>
              </tr>
            ) : (
              awardedBudgets.map((row) => (
                <ProjectSpreadRow
                  key={row.financeProjectId}
                  row={row}
                  monthly={projectMonthly[row.financeProjectId] ?? row.monthly}
                  visibleMonths={visibleMonths}
                  locked={(lockedCells[row.financeProjectId] ?? {}) as Record<MonthKey, boolean>}
                  onCellChange={handleProjectCellChange}
                  onCellSave={handleProjectCellSave}
                  onDistribute={(id) => setDistributingFor({ id, type: 'project' })}
                  onClear={handleProjectClear}
                  onToggleLock={handleToggleLock}
                />
              ))
            )}

            {/* ── Section B: Backlog ────────────────────────────────── */}
            <SectionHeader label="B — Backlog" cols={totalVisibleCols} />
            {backlogBudgets.length === 0 ? (
              <tr>
                <td colSpan={totalVisibleCols} className="px-3 py-3 text-xs text-zinc-400 text-center">
                  No backlog projects for {currentFY}.
                </td>
              </tr>
            ) : (
              backlogBudgets.map((row) => (
                <ProjectSpreadRow
                  key={row.financeProjectId}
                  row={row}
                  monthly={projectMonthly[row.financeProjectId] ?? row.monthly}
                  visibleMonths={visibleMonths}
                  locked={(lockedCells[row.financeProjectId] ?? {}) as Record<MonthKey, boolean>}
                  onCellChange={handleProjectCellChange}
                  onCellSave={handleProjectCellSave}
                  onDistribute={(id) => setDistributingFor({ id, type: 'project' })}
                  onClear={handleProjectClear}
                  onToggleLock={handleToggleLock}
                />
              ))
            )}

            {/* ── Section C: Unsecured ──────────────────────────────── */}
            <tr className="bg-zinc-100">
              <td colSpan={totalVisibleCols} className="px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">C — Unsecured (CRM Leads)</span>
                  <a href="/crm/leads" className="text-xs text-blue-600 hover:underline">
                    View all leads in CRM →
                  </a>
                </div>
              </td>
            </tr>
            {unsecuredBudgets.length === 0 && (
              <tr>
                <td colSpan={totalVisibleCols} className="px-3 py-3 text-xs text-zinc-400 text-center">
                  No unsecured leads added yet. Use &quot;+ Add Lead&quot; below.
                </td>
              </tr>
            )}
            {unsecuredBudgets.map((row) => (
              <UnsecuredSpreadRow
                key={row.leadId}
                row={row}
                monthly={unsecuredMonthly[row.leadId] ?? row.monthly}
                visibleMonths={visibleMonths}
                locked={(lockedCells[row.leadId] ?? {}) as Record<MonthKey, boolean>}
                onCellChange={handleUnsecuredCellChange}
                onCellSave={handleUnsecuredCellSave}
                onDistribute={(id) => setDistributingFor({ id, type: 'unsecured' })}
                onClear={handleUnsecuredClear}
                onRemove={handleRemoveLead}
                onToggleLock={handleToggleLock}
              />
            ))}

            {/* Add Lead row */}
            <tr className="border-b bg-zinc-50">
              <td colSpan={totalVisibleCols} className="px-3 py-2">
                <div className="relative inline-block">
                  <button
                    onClick={() => setShowAddLead(!showAddLead)}
                    className="text-xs text-blue-600 border border-blue-200 rounded px-2 py-1 hover:bg-blue-50"
                  >
                    + Add Lead
                  </button>
                  {showAddLead && (
                    <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-zinc-200 rounded shadow-lg min-w-[260px]">
                      {qualLeads.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-zinc-400">No qualifying leads available.</div>
                      ) : (
                        qualLeads.map((lead) => (
                          <button
                            key={lead.id}
                            onClick={() => handleAddLead(lead.id)}
                            disabled={addingLeadId === lead.id}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 border-b border-zinc-100 last:border-0 disabled:opacity-50"
                          >
                            <span className="font-medium text-zinc-800">{lead.leadName}</span>
                            <span className="ml-2 text-zinc-400">
                              {STAGE_LABELS[lead.stage] ?? lead.stage}
                              {lead.contractValue ? ` · ${fmtAUD(lead.contractValue)}` : ''}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </td>
            </tr>

            {/* ── Section D: Total Budget ────────────────────────────── */}
            <tr className="border-t-2 border-zinc-300 bg-zinc-50 font-semibold text-sm">
              <td colSpan={5} className="px-3 py-2 text-zinc-800">Total Budget</td>
              {visibleMonths.map((key) => (
                <td key={key} className="px-1 py-2 text-right text-xs font-semibold text-zinc-800 whitespace-nowrap">
                  {fmtAUD(columnTotals[key] ?? 0)}
                </td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Distribute popover */}
      {distributingFor && (
        <DistributePopover
          defaultTotal={getDistributeDefault()}
          visibleMonths={ALL_MONTH_KEYS}
          lockedKeys={getDistributeLocked()}
          currentMonthly={getDistributeMonthly()}
          onApply={handleDistributeApply}
          onClose={() => setDistributingFor(null)}
        />
      )}

      {/* Click-outside to close add-lead dropdown */}
      {showAddLead && (
        <div className="fixed inset-0 z-10" onClick={() => setShowAddLead(false)} />
      )}
    </div>
  );
}
