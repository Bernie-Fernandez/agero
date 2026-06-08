'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type {
  CashFlowPageData,
  CashFlowLineItemRow,
  CashFlowForecastSettings,
} from '@/lib/cash-flow/actions';
import {
  addLineItems,
  updateLineItem,
  deleteLineItem,
  updateForecastSettings,
} from '@/lib/cash-flow/actions';
import { CATEGORY_LABELS } from '@/lib/cash-flow/constants';
import type { CashFlowCategory } from '@agero/db';
import { MONTH_KEYS_FY27, MONTH_LABELS } from '@/lib/revenue-budget/constants';

// ─── Formatting ───────────────────────────────────────────────────────────────

const AUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
const AUD2 = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 });
function fmt(v: number) { return AUD.format(v); }
function fmt2(v: number) { return AUD2.format(v); }

// ─── Period helpers ───────────────────────────────────────────────────────────

type WeekPeriod = { label: string; startDate: Date; isoDate: string };
type MonthPeriod = { label: string; date: Date; isoDate: string; monthKey: string };

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function generateWeekPeriods(): WeekPeriod[] {
  const monday = getMondayOfWeek(new Date());
  return Array.from({ length: 13 }, (_, i) => {
    const start = new Date(monday);
    start.setDate(monday.getDate() + i * 7);
    const dayStr = start.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    return {
      label: `Wk ${i + 1}\n${dayStr}`,
      startDate: start,
      isoDate: toISODate(start),
    };
  });
}

const MONTH_KEY_TO_ISO: Record<string, string> = {
  jul26: '2026-07-01', aug26: '2026-08-01', sep26: '2026-09-01',
  oct26: '2026-10-01', nov26: '2026-11-01', dec26: '2026-12-01',
  jan27: '2027-01-01', feb27: '2027-02-01', mar27: '2027-03-01',
  apr27: '2027-04-01', may27: '2027-05-01', jun27: '2027-06-01',
};

function generateMonthPeriods(): MonthPeriod[] {
  return MONTH_KEYS_FY27.map((key) => ({
    label: MONTH_LABELS[key],
    date: new Date(MONTH_KEY_TO_ISO[key]),
    isoDate: MONTH_KEY_TO_ISO[key],
    monthKey: key,
  }));
}

// ─── Category config ──────────────────────────────────────────────────────────

const INFLOW_CATS: CashFlowCategory[] = ['PROGRESS_CLAIM_RECEIPT', 'RETENTION_RELEASE', 'OTHER_INFLOW'];
const OUTFLOW_CATS: CashFlowCategory[] = ['SUBCONTRACTOR_PAYMENT', 'WAGES', 'ATO_BAS', 'ATO_PAYG', 'OVERHEAD', 'LOAN_REPAYMENT', 'OTHER_OUTFLOW'];
const AUTO_CATS: CashFlowCategory[] = ['PROGRESS_CLAIM_RECEIPT', 'OVERHEAD'];

// ─── Settings Modal ───────────────────────────────────────────────────────────

function SettingsModal({
  settings,
  onSave,
  onClose,
}: {
  settings: CashFlowForecastSettings;
  onSave: (s: Partial<CashFlowForecastSettings>) => Promise<void>;
  onClose: () => void;
}) {
  const [minCash, setMinCash] = useState(String(settings.minimumCash));
  const [arDays, setArDays] = useState(String(settings.arCollectionDays));
  const [apDays, setApDays] = useState(String(settings.apPaymentDays));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave({ minimumCash: Number(minCash) || 0, arCollectionDays: Number(arDays) || 21, apPaymentDays: Number(apDays) || 30 });
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl border border-zinc-200 p-6 w-full max-w-md mx-4">
        <h3 className="text-base font-semibold text-zinc-900 mb-4">Forecast Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-600 block mb-1">Minimum cash holdback ($)</label>
            <p className="text-xs text-zinc-400 mb-1.5">Weeks/months below this close balance are highlighted red.</p>
            <input type="number" min="0" step="1000" value={minCash} onChange={(e) => setMinCash(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm w-full" />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600 block mb-1">AR collection days</label>
            <p className="text-xs text-zinc-400 mb-1.5">Days from invoice to expected receipt (default: 21).</p>
            <input type="number" min="1" max="90" value={arDays} onChange={(e) => setArDays(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm w-full" />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600 block mb-1">AP payment days</label>
            <p className="text-xs text-zinc-400 mb-1.5">Days from bill receipt to payment (default: 30).</p>
            <input type="number" min="1" max="90" value={apDays} onChange={(e) => setApDays(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm w-full" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 border border-zinc-300 rounded-lg hover:bg-zinc-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Item Modal ───────────────────────────────────────────────────────────

type PeriodOption = { label: string; isoDate: string };

function AddItemModal({
  forecastId,
  presetCategory,
  periodOptions,
  view,
  onSave,
  onClose,
}: {
  forecastId: string;
  presetCategory: CashFlowCategory;
  periodOptions: PeriodOption[];
  view: 'week' | 'month';
  onSave: (items: CashFlowLineItemRow[]) => void;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<CashFlowCategory>(presetCategory);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [periodDate, setPeriodDate] = useState(periodOptions[0]?.isoDate ?? '');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'fortnightly' | 'monthly'>('fortnightly');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allCategories: CashFlowCategory[] = [...INFLOW_CATS, ...OUTFLOW_CATS];

  function buildItems(): { category: CashFlowCategory; description: string; amount: number; periodDate: string; isRecurring: boolean; recurringFrequency: string | null; notes: string | null }[] {
    const amt = Number(amount) || 0;
    const base = { category, description: description || CATEGORY_LABELS[category], amount: amt, isRecurring, recurringFrequency: isRecurring ? recurringFrequency : null, notes: notes || null };

    if (!isRecurring) return [{ ...base, periodDate }];

    // Generate entries for all applicable periods
    const fromIdx = periodOptions.findIndex((p) => p.isoDate === periodDate);
    if (fromIdx < 0) return [{ ...base, periodDate }];

    const step = recurringFrequency === 'weekly' ? 1 : recurringFrequency === 'fortnightly' ? 2 : 1;
    const items = [];
    for (let i = fromIdx; i < periodOptions.length; i += (view === 'week' ? step : 1)) {
      if (view === 'month' && recurringFrequency === 'fortnightly') break; // fortnightly doesn't apply to monthly
      items.push({ ...base, periodDate: periodOptions[i].isoDate, isRecurring: true });
    }
    return items;
  }

  async function handleSave() {
    if (!amount || Number(amount) <= 0) { setError('Amount must be greater than zero.'); return; }
    setSaving(true);
    setError(null);
    const items = buildItems();
    const res = await addLineItems(forecastId, items);
    if (!res.ok) { setError(res.error ?? 'Failed to save.'); setSaving(false); return; }
    onSave(res.items ?? []);
    onClose();
  }

  const periodCount = isRecurring ? buildItems().length : 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl border border-zinc-200 p-6 w-full max-w-md mx-4">
        <h3 className="text-base font-semibold text-zinc-900 mb-4">Add Cash Flow Entry</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-zinc-600 block mb-1">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as CashFlowCategory)}
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm bg-white">
              <optgroup label="INFLOWS">
                {INFLOW_CATS.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </optgroup>
              <optgroup label="OUTFLOWS">
                {OUTFLOW_CATS.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </optgroup>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600 block mb-1">Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder={CATEGORY_LABELS[category]}
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600 block mb-1">Amount ($)</label>
            <input type="number" min="0" step="1000" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm" autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600 block mb-1">{view === 'week' ? 'Week' : 'Month'}</label>
            <select value={periodDate} onChange={(e) => setPeriodDate(e.target.value)}
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm bg-white">
              {periodOptions.map((p) => <option key={p.isoDate} value={p.isoDate}>{p.label.replace('\n', ' ')}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="accent-blue-600" />
            <span className="text-sm text-zinc-700">Recurring entry</span>
          </label>
          {isRecurring && (
            <div>
              <label className="text-xs font-medium text-zinc-600 block mb-1">Frequency</label>
              <select value={recurringFrequency} onChange={(e) => setRecurringFrequency(e.target.value as typeof recurringFrequency)}
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm bg-white">
                {view === 'week' && <option value="weekly">Weekly</option>}
                {view === 'week' && <option value="fortnightly">Fortnightly</option>}
                <option value="monthly">Monthly (every period)</option>
              </select>
              <p className="text-xs text-zinc-400 mt-1">Creates {periodCount} {periodCount === 1 ? 'entry' : 'entries'} from selected period to end of forecast.</p>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-zinc-600 block mb-1">Notes (optional)</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 border border-zinc-300 rounded-lg hover:bg-zinc-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : `Add ${periodCount > 1 ? `${periodCount} Entries` : 'Entry'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Cash Flow Grid ────────────────────────────────────────────────────────────

type GridProps = {
  periods: { label: string; isoDate: string }[];
  lineItems: CashFlowLineItemRow[];
  autoAmounts: Record<string, Record<CashFlowCategory, number>>;
  openingBalance: number;
  minimumCash: number;
  forecastId: string;
  view: 'week' | 'month';
  onAdd: (category: CashFlowCategory) => void;
  onItemsChange: (items: CashFlowLineItemRow[]) => void;
};

function CashFlowGrid({ periods, lineItems, autoAmounts, openingBalance, minimumCash, view, onAdd, onItemsChange }: GridProps) {
  const [, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');

  function getManualAmount(cat: CashFlowCategory, iso: string): number {
    return lineItems
      .filter((li) => li.category === cat && li.periodDate.startsWith(iso))
      .reduce((s, li) => s + li.amount, 0);
  }

  function getTotalAmount(cat: CashFlowCategory, iso: string): number {
    const manual = getManualAmount(cat, iso);
    const auto = autoAmounts[iso]?.[cat] ?? 0;
    return manual + auto;
  }

  // Compute running balance
  const { closingBalances, openingBalances } = useMemo(() => {
    const openings: number[] = [];
    const closings: number[] = [];
    let running = openingBalance;
    for (const p of periods) {
      openings.push(running);
      const totalInflow = INFLOW_CATS.reduce((s, c) => s + getTotalAmount(c, p.isoDate), 0);
      const totalOutflow = OUTFLOW_CATS.reduce((s, c) => s + getTotalAmount(c, p.isoDate), 0);
      const net = totalInflow - totalOutflow;
      running = running + net;
      closings.push(running);
    }
    return { closingBalances: closings, openingBalances: openings };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods, lineItems, autoAmounts, openingBalance]);

  const belowMinPeriods = closingBalances.filter((b) => minimumCash > 0 && b < minimumCash);

  function handleDeleteItem(id: string) {
    startTransition(async () => {
      await deleteLineItem(id);
      onItemsChange(lineItems.filter((li) => li.id !== id));
    });
  }

  function startEdit(li: CashFlowLineItemRow) {
    setEditingId(li.id);
    setEditAmount(String(li.amount));
  }

  function handleEditSave(id: string) {
    startTransition(async () => {
      await updateLineItem(id, { amount: Number(editAmount) || 0 });
      onItemsChange(lineItems.map((li) => li.id === id ? { ...li, amount: Number(editAmount) || 0 } : li));
      setEditingId(null);
    });
  }

  const totalInflows = periods.reduce((s, p) => s + INFLOW_CATS.reduce((ss, c) => ss + getTotalAmount(c, p.isoDate), 0), 0);
  const totalOutflows = periods.reduce((s, p) => s + OUTFLOW_CATS.reduce((ss, c) => ss + getTotalAmount(c, p.isoDate), 0), 0);

  function CatRow({ cat }: { cat: CashFlowCategory }) {
    const isAuto = AUTO_CATS.includes(cat);
    const periodTotals = periods.map((p) => getTotalAmount(cat, p.isoDate));
    const total = periodTotals.reduce((s, v) => s + v, 0);

    return (
      <tr className="border-b border-zinc-100 hover:bg-zinc-50/50">
        <td className="px-3 py-1.5 text-xs text-zinc-600 whitespace-nowrap">
          <div className="flex items-center gap-1">
            {isAuto && <span className="text-[9px] bg-zinc-100 text-zinc-400 px-1 rounded">AUTO</span>}
            {CATEGORY_LABELS[cat]}
            {!isAuto && (
              <button onClick={() => onAdd(cat)} className="ml-1 text-blue-400 hover:text-blue-600 text-xs leading-none" title="Add entry">+</button>
            )}
          </div>
        </td>
        {periodTotals.map((v, i) => (
          <td key={i} className={`px-2 py-1.5 text-right text-xs font-mono whitespace-nowrap ${isAuto ? 'text-zinc-400' : v !== 0 ? 'text-zinc-800' : 'text-zinc-300'}`}>
            {v !== 0 ? fmt(v) : '—'}
          </td>
        ))}
        <td className="px-2 py-1.5 text-right text-xs font-mono font-semibold text-zinc-700 whitespace-nowrap border-l border-zinc-200">
          {total !== 0 ? fmt(total) : '—'}
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-4">
      {belowMinPeriods.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-3 text-sm text-red-700">
          ⚠ Cash position falls below minimum ({fmt(minimumCash)}) in {belowMinPeriods.length} {view === 'week' ? 'week(s)' : 'month(s)'}. Review outflows or accelerate collections.
        </div>
      )}

      <div className="overflow-x-auto border border-zinc-200 rounded-xl bg-white">
        <table className="text-sm border-collapse" style={{ minWidth: `${280 + periods.length * 80}px` }}>
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr className="text-[11px] text-zinc-500">
              <th className="px-3 py-2 text-left w-48 sticky left-0 bg-zinc-50">Category</th>
              {periods.map((p, i) => (
                <th key={i} className="px-2 py-2 text-center w-20 whitespace-pre-line leading-tight">{p.label}</th>
              ))}
              <th className="px-2 py-2 text-center w-24 border-l border-zinc-200 font-semibold text-zinc-700">Total</th>
            </tr>
          </thead>
          <tbody>
            {/* INFLOWS */}
            <tr className="bg-emerald-50">
              <td colSpan={periods.length + 2} className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Inflows
              </td>
            </tr>
            {INFLOW_CATS.map((c) => <CatRow key={c} cat={c} />)}

            {/* Total Inflows */}
            <tr className="bg-emerald-100 border-t border-emerald-200">
              <td className="px-3 py-1.5 text-xs font-semibold text-emerald-800 sticky left-0 bg-emerald-100">Total Inflows</td>
              {periods.map((p, i) => {
                const v = INFLOW_CATS.reduce((s, c) => s + getTotalAmount(c, p.isoDate), 0);
                return <td key={i} className="px-2 py-1.5 text-right text-xs font-mono font-semibold text-emerald-800">{v !== 0 ? fmt(v) : '—'}</td>;
              })}
              <td className="px-2 py-1.5 text-right text-xs font-mono font-bold text-emerald-800 border-l border-zinc-200">{fmt(totalInflows)}</td>
            </tr>

            {/* OUTFLOWS */}
            <tr className="bg-red-50">
              <td colSpan={periods.length + 2} className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-red-600">
                Outflows
              </td>
            </tr>
            {OUTFLOW_CATS.map((c) => <CatRow key={c} cat={c} />)}

            {/* Total Outflows */}
            <tr className="bg-red-100 border-t border-red-200">
              <td className="px-3 py-1.5 text-xs font-semibold text-red-800 sticky left-0 bg-red-100">Total Outflows</td>
              {periods.map((p, i) => {
                const v = OUTFLOW_CATS.reduce((s, c) => s + getTotalAmount(c, p.isoDate), 0);
                return <td key={i} className="px-2 py-1.5 text-right text-xs font-mono font-semibold text-red-800">{v !== 0 ? fmt(v) : '—'}</td>;
              })}
              <td className="px-2 py-1.5 text-right text-xs font-mono font-bold text-red-800 border-l border-zinc-200">{fmt(totalOutflows)}</td>
            </tr>

            {/* NET / BALANCE */}
            <tr className="bg-zinc-800 text-white">
              <td className="px-3 py-1.5 text-xs font-semibold sticky left-0 bg-zinc-800">Net Cash Flow</td>
              {periods.map((p, i) => {
                const inf = INFLOW_CATS.reduce((s, c) => s + getTotalAmount(c, p.isoDate), 0);
                const out = OUTFLOW_CATS.reduce((s, c) => s + getTotalAmount(c, p.isoDate), 0);
                const net = inf - out;
                return <td key={i} className={`px-2 py-1.5 text-right text-xs font-mono font-semibold ${net < 0 ? 'text-red-300' : net > 0 ? 'text-emerald-300' : 'text-zinc-400'}`}>{net !== 0 ? fmt(net) : '—'}</td>;
              })}
              <td className="px-2 py-1.5 text-right text-xs font-mono font-bold border-l border-zinc-600">
                {fmt(totalInflows - totalOutflows)}
              </td>
            </tr>

            <tr className="bg-zinc-100">
              <td className="px-3 py-1.5 text-xs font-medium text-zinc-600 sticky left-0 bg-zinc-100">Opening Balance</td>
              {openingBalances.map((v, i) => (
                <td key={i} className="px-2 py-1.5 text-right text-xs font-mono text-zinc-600">{fmt(v)}</td>
              ))}
              <td className="px-2 py-1.5 border-l border-zinc-200" />
            </tr>

            <tr className="bg-zinc-900 text-white">
              <td className="px-3 py-2 text-xs font-bold sticky left-0 bg-zinc-900">Closing Balance</td>
              {closingBalances.map((v, i) => (
                <td key={i} className={`px-2 py-2 text-right text-xs font-mono font-bold ${minimumCash > 0 && v < minimumCash ? 'bg-red-700 text-red-100' : v < 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                  {fmt(v)}
                </td>
              ))}
              <td className="px-2 py-2 border-l border-zinc-700" />
            </tr>

            {minimumCash > 0 && (
              <tr className="bg-amber-50">
                <td className="px-3 py-1.5 text-[11px] text-amber-700 sticky left-0 bg-amber-50">Min. Cash ({fmt(minimumCash)})</td>
                {periods.map((_, i) => (
                  <td key={i} className="px-2 py-1.5 text-right text-[11px] font-mono text-amber-600">{fmt(minimumCash)}</td>
                ))}
                <td className="px-2 py-1.5 border-l border-zinc-200" />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Line items list — edit/delete */}
      {lineItems.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100">
            <h3 className="text-sm font-semibold text-zinc-700">Manual Entries ({lineItems.length})</h3>
          </div>
          <div className="divide-y divide-zinc-100">
            {lineItems.map((li) => (
              <div key={li.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${li.direction === 'INFLOW' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {li.direction === 'INFLOW' ? '▲' : '▼'}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-zinc-800">{li.description}</span>
                  <span className="ml-2 text-xs text-zinc-400">{CATEGORY_LABELS[li.category]}</span>
                  {li.isRecurring && <span className="ml-1 text-[10px] text-blue-500">[{li.recurringFrequency}]</span>}
                </div>
                <span className="text-xs text-zinc-500 whitespace-nowrap">
                  {new Date(li.periodDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' })}
                </span>
                {editingId === li.id ? (
                  <div className="flex items-center gap-1">
                    <input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)}
                      className="w-24 text-right text-xs border border-zinc-300 rounded px-1 py-0.5" autoFocus />
                    <button onClick={() => handleEditSave(li.id)} className="text-xs text-blue-600 hover:underline">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-zinc-400 hover:underline">Cancel</button>
                  </div>
                ) : (
                  <span className="text-xs font-mono font-medium text-zinc-800 whitespace-nowrap">{fmt2(li.amount)}</span>
                )}
                {editingId !== li.id && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEdit(li)} className="text-xs text-zinc-400 hover:text-zinc-700">Edit</button>
                    <button onClick={() => handleDeleteItem(li.id)} className="text-xs text-red-400 hover:text-red-700">×</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function CashFlowClient({ initialData }: { initialData: CashFlowPageData }) {
  const router = useRouter();
  const [view, setView] = useState<'week' | 'month'>('week');
  const [settings, setSettings] = useState<CashFlowForecastSettings>(initialData.forecast);
  const [lineItems, setLineItems] = useState<CashFlowLineItemRow[]>(initialData.lineItems);
  const [showSettings, setShowSettings] = useState(false);
  const [addModalCat, setAddModalCat] = useState<CashFlowCategory | null>(null);
  const [, startTransition] = useTransition();

  const weekPeriods = useMemo(() => generateWeekPeriods(), []);
  const monthPeriods = useMemo(() => generateMonthPeriods(), []);

  const periods = view === 'week' ? weekPeriods : monthPeriods;
  const periodOptions = periods.map((p) => ({ label: p.label, isoDate: p.isoDate }));

  // Auto-calculated amounts per period
  const autoAmounts = useMemo(() => {
    const result: Record<string, Record<CashFlowCategory, number>> = {};

    if (view === 'week') {
      // AR spread: spread AR balance across first ceil(arDays/7) weeks
      const arWeeks = Math.max(1, Math.ceil(settings.arCollectionDays / 7));
      const arPerWeek = settings.arCollectionDays > 0 ? initialData.bsARBalance / arWeeks : 0;
      weekPeriods.forEach((p, i) => {
        result[p.isoDate] = {} as Record<CashFlowCategory, number>;
        result[p.isoDate]['PROGRESS_CLAIM_RECEIPT'] = i < arWeeks ? Math.round(arPerWeek) : 0;
        result[p.isoDate]['OVERHEAD'] = 0; // weekly overhead is manual
        // Fill other auto cats with 0
        for (const c of [...INFLOW_CATS, ...OUTFLOW_CATS]) {
          if (!(c in result[p.isoDate])) result[p.isoDate][c] = 0;
        }
      });
    } else {
      // Monthly: budget revenue + overhead average
      monthPeriods.forEach((p) => {
        result[p.isoDate] = {} as Record<CashFlowCategory, number>;
        const budgetRev = initialData.budgetTotals[p.monthKey] ?? 0;
        result[p.isoDate]['PROGRESS_CLAIM_RECEIPT'] = Math.round(budgetRev);
        result[p.isoDate]['OVERHEAD'] = Math.round(initialData.overheadMonthlyAvg);
        for (const c of [...INFLOW_CATS, ...OUTFLOW_CATS]) {
          if (!(c in result[p.isoDate])) result[p.isoDate][c] = 0;
        }
      });
    }

    return result;
  }, [view, weekPeriods, monthPeriods, settings.arCollectionDays, initialData]);

  async function handleSaveSettings(s: Partial<CashFlowForecastSettings>) {
    const updated = { ...settings, ...s };
    await updateForecastSettings({
      forecastId: settings.id,
      minimumCash: updated.minimumCash,
      arCollectionDays: updated.arCollectionDays,
      apPaymentDays: updated.apPaymentDays,
    });
    setSettings(updated);
  }

  const bsDateLabel = initialData.bsDate
    ? new Date(initialData.bsDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="p-6 max-w-full space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Cash Flow Forecast</h1>
          {bsDateLabel && (
            <p className="text-sm text-zinc-500 mt-0.5">
              Opening balance: <span className="font-semibold text-zinc-800">{fmt(initialData.bsCashBalance)}</span>
              <span className="ml-1 text-zinc-400">as at {bsDateLabel}</span>
            </p>
          )}
          {!bsDateLabel && (
            <p className="text-sm text-amber-600 mt-0.5">No Balance Sheet data — <a href="/finance/balance-sheet" className="underline">sync Balance Sheet</a> to set opening balance.</p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden border border-zinc-300">
            <button
              onClick={() => setView('week')}
              className={`px-4 py-1.5 text-sm font-medium ${view === 'week' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'}`}
            >
              13-Week
            </button>
            <button
              onClick={() => setView('month')}
              className={`px-4 py-1.5 text-sm font-medium border-l border-zinc-300 ${view === 'month' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'}`}
            >
              12-Month
            </button>
          </div>

          <button
            onClick={() => setShowSettings(true)}
            className="px-4 py-1.5 text-sm text-zinc-600 border border-zinc-300 rounded-lg hover:bg-zinc-50"
          >
            ⚙ Settings
          </button>

          <button
            onClick={() => startTransition(() => router.refresh())}
            className="px-4 py-1.5 text-sm text-zinc-500 border border-zinc-200 rounded-lg hover:bg-zinc-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Minimum cash indicator */}
      {settings.minimumCash > 0 && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 inline-flex items-center gap-2">
          <span className="font-medium">Minimum cash holdback:</span> {fmt(settings.minimumCash)}
          <button onClick={() => setShowSettings(true)} className="text-amber-600 hover:underline text-xs">Edit</button>
        </div>
      )}

      {/* View description */}
      <p className="text-xs text-zinc-400">
        {view === 'week'
          ? `13-week rolling forecast from ${weekPeriods[0]?.startDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) ?? ''}. Progress Claims auto-calculated from Xero AR (${settings.arCollectionDays}-day collection).`
          : `12-month FY27 forecast (Jul 2026 – Jun 2027). Budget Revenue from Backlog Budget spread. Overheads from 3-month P&L average (${fmt(initialData.overheadMonthlyAvg)}/month).`
        }
      </p>

      {/* Grid */}
      <CashFlowGrid
        periods={periodOptions}
        lineItems={lineItems}
        autoAmounts={autoAmounts}
        openingBalance={settings.openingBalance}
        minimumCash={settings.minimumCash}
        forecastId={settings.id}
        view={view}
        onAdd={(cat) => setAddModalCat(cat)}
        onItemsChange={setLineItems}
      />

      {/* Modals */}
      {showSettings && (
        <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />
      )}

      {addModalCat && (
        <AddItemModal
          forecastId={settings.id}
          presetCategory={addModalCat}
          periodOptions={periodOptions}
          view={view}
          onSave={(newItems) => setLineItems((prev) => [...prev, ...newItems])}
          onClose={() => setAddModalCat(null)}
        />
      )}
    </div>
  );
}
