'use client';
import { useState, useRef, useCallback } from 'react';

const MONTHS = ['jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun'] as const;
type Month = typeof MONTHS[number];

type Row = {
  id: string;
  jobNumber: string;
  projectName: string;
  status: string;
  marginPercent: string;
  nextYearWip: string;
  total: string;
} & Record<Month, string>;

function toN(v: string | number) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}
function fmt(n: number) {
  if (n === 0) return '';
  return n.toLocaleString('en-AU', { maximumFractionDigits: 0 });
}
function fmtPct(v: string) {
  const n = toN(v);
  return (n * 100).toFixed(1) + '%';
}

function rowTotal(row: Row) {
  return MONTHS.reduce((s, m) => s + toN(row[m]), 0) + toN(row.nextYearWip);
}

export default function SecuredForecastClient({ forecasts: initial, defaultFY }: { forecasts: Row[]; defaultFY: number }) {
  const [fy, setFY] = useState(defaultFY);
  const [rows, setRows] = useState<Row[]>(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const colTotals = MONTHS.reduce((acc, m) => {
    acc[m] = rows.reduce((s, r) => s + toN(r[m]), 0);
    return acc;
  }, {} as Record<Month, number>);
  const nextYearTotal = rows.reduce((s, r) => s + toN(r.nextYearWip), 0);
  const grandTotal = rows.reduce((s, r) => s + rowTotal(r), 0);

  function handleCell(id: string, field: Month | 'nextYearWip', value: string) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
    setDirty(true);
    setSaved(false);
  }

  const handleKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colIdx: number,
    allCols: string[],
  ) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const nextColIdx = e.shiftKey ? colIdx - 1 : colIdx + 1;
      if (nextColIdx >= 0 && nextColIdx < allCols.length) {
        const key = `${rows[rowIdx].id}_${allCols[nextColIdx]}`;
        inputRefs.current[key]?.focus();
      } else if (nextColIdx >= allCols.length && rowIdx < rows.length - 1) {
        const key = `${rows[rowIdx + 1].id}_${allCols[0]}`;
        inputRefs.current[key]?.focus();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (rowIdx < rows.length - 1) {
        const key = `${rows[rowIdx + 1].id}_${allCols[colIdx]}`;
        inputRefs.current[key]?.focus();
      }
    }
  }, [rows]);

  async function saveAll() {
    setSaving(true);
    const res = await fetch('/api/finance/secured-forecast/bulk-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, financialYear: fy }),
    });
    if (res.ok) {
      setDirty(false);
      setSaved(true);
    }
    setSaving(false);
  }

  const allCols = [...MONTHS, 'nextYearWip'] as const;

  const fyOptions = Array.from({ length: 5 }, (_, i) => defaultFY - 2 + i);

  return (
    <div className="max-w-full px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Secured Forecast</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Monthly revenue spread for awarded and backlog projects.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={fy}
            onChange={(e) => setFY(Number(e.target.value))}
            className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
          >
            {fyOptions.map((y) => (
              <option key={y} value={y}>FY{y - 1}-{String(y).slice(2)}</option>
            ))}
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
          No projects found for FY{fy - 1}–{String(fy).slice(2)}. Add awarded or backlog projects in Finance → Projects first.
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-auto">
          <table className="w-full text-sm" style={{ minWidth: '1400px' }}>
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500 sticky left-0 bg-zinc-50 z-10">Job</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500 min-w-[180px]">Project</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500">Status</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-500">Margin%</th>
                {MONTHS.map((m) => (
                  <th key={m} className="text-right px-2 py-2 text-xs font-semibold text-zinc-500 capitalize min-w-[80px]">{m}</th>
                ))}
                <th className="text-right px-2 py-2 text-xs font-semibold text-zinc-500 min-w-[90px]">Nxt Yr WIP</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-zinc-500 min-w-[100px]">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((row, ri) => (
                <tr key={row.id} className="hover:bg-zinc-50">
                  <td className="px-3 py-1 font-mono text-xs text-zinc-600 sticky left-0 bg-white">{row.jobNumber}</td>
                  <td className="px-3 py-1 text-zinc-900 font-medium text-xs">{row.projectName}</td>
                  <td className="px-3 py-1 text-xs text-zinc-500">{row.status}</td>
                  <td className="px-3 py-1 text-right text-xs text-zinc-600">{fmtPct(row.marginPercent)}</td>
                  {allCols.map((col, ci) => {
                    const key = `${row.id}_${col}`;
                    return (
                      <td key={col} className="px-1 py-1">
                        <input
                          ref={(el) => { inputRefs.current[key] = el; }}
                          type="number"
                          value={row[col as keyof Row] === '0' ? '' : row[col as keyof Row]}
                          onChange={(e) => handleCell(row.id, col as Month | 'nextYearWip', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, ri, ci, allCols as unknown as string[])}
                          className="w-full text-right text-xs border-0 bg-transparent focus:bg-zinc-100 focus:outline-none focus:ring-1 focus:ring-brand/30 rounded px-2 py-1"
                          placeholder="0"
                        />
                      </td>
                    );
                  })}
                  <td className="px-3 py-1 text-right text-xs font-semibold text-zinc-700">
                    {fmt(rowTotal(row))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-zinc-200 bg-zinc-50">
              <tr>
                <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-zinc-700">Total</td>
                {MONTHS.map((m) => (
                  <td key={m} className="px-2 py-2 text-right text-xs font-semibold text-zinc-700">{fmt(colTotals[m])}</td>
                ))}
                <td className="px-2 py-2 text-right text-xs font-semibold text-zinc-700">{fmt(nextYearTotal)}</td>
                <td className="px-3 py-2 text-right text-xs font-semibold text-zinc-900">{fmt(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
