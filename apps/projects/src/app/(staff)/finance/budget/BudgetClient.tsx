'use client';
import { useState, useRef, useCallback } from 'react';

const MONTHS = ['jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun'] as const;
type Month = typeof MONTHS[number];

type BudgetRow = {
  id: string;
  category: string;
  lineItem: string;
  displayOrder: number;
  total: string;
} & Record<Month, string>;

const CATEGORY_ORDER = ['REVENUE', 'COST_OF_SALES', 'DIRECT_LABOUR', 'INDIRECT_EXPENSES', 'INDIRECT_LABOUR', 'MARKETING'];
const CATEGORY_LABELS: Record<string, string> = {
  REVENUE: 'Revenue',
  COST_OF_SALES: 'Cost of Sales',
  DIRECT_LABOUR: 'Direct Labour',
  INDIRECT_EXPENSES: 'Indirect Expenses',
  INDIRECT_LABOUR: 'Indirect Labour',
  MARKETING: 'Marketing Expenses',
};

function toN(v: string | number) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}
function fmt(n: number) {
  if (n === 0) return '';
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
}
function rowTotal(row: BudgetRow) {
  return MONTHS.reduce((s, m) => s + toN(row[m]), 0);
}

function groupBy(rows: BudgetRow[]) {
  const groups: Record<string, BudgetRow[]> = {};
  for (const cat of CATEGORY_ORDER) groups[cat] = [];
  for (const row of rows) {
    if (!groups[row.category]) groups[row.category] = [];
    groups[row.category].push(row);
  }
  return groups;
}

export default function BudgetClient({
  budgets: initial, defaultFY, organisationId,
}: {
  budgets: BudgetRow[];
  defaultFY: number;
  organisationId: string;
}) {
  const [fy, setFY] = useState(defaultFY);
  const [rows, setRows] = useState<BudgetRow[]>(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const groups = groupBy(rows);

  function getColTotal(m: Month) {
    return rows.reduce((s, r) => s + toN(r[m]), 0);
  }

  function getCatTotal(cat: string, m?: Month) {
    const catRows = groups[cat] ?? [];
    if (m) return catRows.reduce((s, r) => s + toN(r[m]), 0);
    return catRows.reduce((s, r) => s + rowTotal(r), 0);
  }

  const revenue = groups['REVENUE']?.reduce((s, r) => s + rowTotal(r), 0) ?? 0;
  const cos = groups['COST_OF_SALES']?.reduce((s, r) => s + rowTotal(r), 0) ?? 0;
  const dl = groups['DIRECT_LABOUR']?.reduce((s, r) => s + rowTotal(r), 0) ?? 0;
  const ie = groups['INDIRECT_EXPENSES']?.reduce((s, r) => s + rowTotal(r), 0) ?? 0;
  const il = groups['INDIRECT_LABOUR']?.reduce((s, r) => s + rowTotal(r), 0) ?? 0;
  const mk = groups['MARKETING']?.reduce((s, r) => s + rowTotal(r), 0) ?? 0;
  const grossProfit = revenue - cos - dl;
  const netProfit = grossProfit - ie - il - mk;

  function handleCell(id: string, m: Month, value: string) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [m]: value } : r));
    setDirty(true);
    setSaved(false);
  }

  const flatRows = CATEGORY_ORDER.flatMap((cat) => groups[cat] ?? []);

  const handleKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colIdx: number,
  ) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const nextCol = e.shiftKey ? colIdx - 1 : colIdx + 1;
      if (nextCol >= 0 && nextCol < MONTHS.length) {
        const key = `${flatRows[rowIdx].id}_${MONTHS[nextCol]}`;
        inputRefs.current[key]?.focus();
      } else if (nextCol >= MONTHS.length && rowIdx < flatRows.length - 1) {
        const key = `${flatRows[rowIdx + 1].id}_${MONTHS[0]}`;
        inputRefs.current[key]?.focus();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (rowIdx < flatRows.length - 1) {
        const key = `${flatRows[rowIdx + 1].id}_${MONTHS[colIdx]}`;
        inputRefs.current[key]?.focus();
      }
    }
  }, [flatRows]);

  async function saveAll() {
    setSaving(true);
    const res = await fetch('/api/finance/budget/bulk-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, financialYear: fy }),
    });
    if (res.ok) { setDirty(false); setSaved(true); }
    setSaving(false);
  }

  const fyOptions = Array.from({ length: 5 }, (_, i) => defaultFY - 2 + i);

  return (
    <div className="max-w-full px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Annual Budget</h1>
          <p className="text-sm text-zinc-500 mt-0.5">FY budget by category and line item.</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={fy} onChange={(e) => setFY(Number(e.target.value))} className="border border-zinc-200 rounded-lg px-3 py-2 text-sm">
            {fyOptions.map((y) => <option key={y} value={y}>FY{y - 1}-{String(y).slice(2)}</option>)}
          </select>
          <button
            onClick={saveAll}
            disabled={!dirty || saving}
            className="px-4 py-2 bg-brand hover:bg-brand/90 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save All'}
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center text-sm text-zinc-400">
          No budget data for FY{fy - 1}–{String(fy).slice(2)}. Upload from the seed script or add via API.
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-auto">
          <table className="w-full text-sm" style={{ minWidth: '1200px' }}>
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500 sticky left-0 bg-zinc-50 min-w-[220px]">Line Item</th>
                {MONTHS.map((m) => (
                  <th key={m} className="text-right px-2 py-2 text-xs font-semibold text-zinc-500 capitalize min-w-[80px]">{m}</th>
                ))}
                <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-500 min-w-[100px]">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {CATEGORY_ORDER.map((cat) => {
                const catRows = groups[cat] ?? [];
                if (catRows.length === 0) return null;
                return [
                  <tr key={`cat-${cat}`} className="bg-zinc-50">
                    <td colSpan={MONTHS.length + 2} className="px-3 py-1.5 text-xs font-bold text-zinc-600 uppercase tracking-wide">
                      {CATEGORY_LABELS[cat] ?? cat}
                    </td>
                  </tr>,
                  ...catRows.map((row, ri) => {
                    const flatIdx = flatRows.findIndex((r) => r.id === row.id);
                    return (
                      <tr key={row.id} className="hover:bg-zinc-50">
                        <td className="px-3 py-1 text-zinc-700 sticky left-0 bg-white text-xs">{row.lineItem}</td>
                        {MONTHS.map((m, ci) => {
                          const key = `${row.id}_${m}`;
                          return (
                            <td key={m} className="px-1 py-1">
                              <input
                                ref={(el) => { inputRefs.current[key] = el; }}
                                type="number"
                                value={row[m] === '0' ? '' : row[m]}
                                onChange={(e) => handleCell(row.id, m, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, flatIdx, ci)}
                                className="w-full text-right text-xs border-0 bg-transparent focus:bg-zinc-100 focus:outline-none focus:ring-1 focus:ring-brand/30 rounded px-2 py-1"
                                placeholder="0"
                              />
                            </td>
                          );
                        })}
                        <td className="px-3 py-1 text-right text-xs font-semibold text-zinc-700">{fmt(rowTotal(row))}</td>
                      </tr>
                    );
                  }),
                  <tr key={`subtotal-${cat}`} className="border-t border-zinc-200 bg-zinc-50">
                    <td className="px-3 py-1.5 text-xs font-semibold text-zinc-700">Subtotal — {CATEGORY_LABELS[cat] ?? cat}</td>
                    {MONTHS.map((m) => (
                      <td key={m} className="px-2 py-1.5 text-right text-xs font-semibold text-zinc-700">{fmt(getCatTotal(cat, m))}</td>
                    ))}
                    <td className="px-3 py-1.5 text-right text-xs font-semibold text-zinc-900">{fmt(getCatTotal(cat))}</td>
                  </tr>,
                ];
              })}

              {/* Derived rows */}
              <tr className="border-t-2 border-zinc-300 bg-green-50">
                <td className="px-3 py-2 text-xs font-bold text-green-800">Gross Profit</td>
                {MONTHS.map((m) => {
                  const rev = getCatTotal('REVENUE', m);
                  const c = getCatTotal('COST_OF_SALES', m);
                  const d = getCatTotal('DIRECT_LABOUR', m);
                  return <td key={m} className="px-2 py-2 text-right text-xs font-bold text-green-800">{fmt(rev - c - d)}</td>;
                })}
                <td className="px-3 py-2 text-right text-xs font-bold text-green-800">{fmt(grossProfit)}</td>
              </tr>
              <tr className="bg-blue-50">
                <td className="px-3 py-2 text-xs font-bold text-blue-800">Net Profit Before Tax</td>
                {MONTHS.map((m) => {
                  const rev = getCatTotal('REVENUE', m);
                  const c = getCatTotal('COST_OF_SALES', m);
                  const d = getCatTotal('DIRECT_LABOUR', m);
                  const i = getCatTotal('INDIRECT_EXPENSES', m);
                  const il = getCatTotal('INDIRECT_LABOUR', m);
                  const mk = getCatTotal('MARKETING', m);
                  return <td key={m} className="px-2 py-2 text-right text-xs font-bold text-blue-800">{fmt(rev - c - d - i - il - mk)}</td>;
                })}
                <td className="px-3 py-2 text-right text-xs font-bold text-blue-800">{fmt(netProfit)}</td>
              </tr>
            </tbody>
            <tfoot className="border-t-2 border-zinc-200 bg-zinc-50">
              <tr>
                <td className="px-3 py-2 text-xs font-semibold text-zinc-700">Column Total</td>
                {MONTHS.map((m) => (
                  <td key={m} className="px-2 py-2 text-right text-xs font-semibold text-zinc-700">{fmt(getColTotal(m))}</td>
                ))}
                <td className="px-3 py-2 text-right text-xs font-semibold text-zinc-900">{fmt(rows.reduce((s, r) => s + rowTotal(r), 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
