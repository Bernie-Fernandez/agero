'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const MONTHS = ['jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun'] as const;
type Month = typeof MONTHS[number];
const MONTH_LABELS: Record<Month, string> = {
  jul: 'Jul', aug: 'Aug', sep: 'Sep', oct: 'Oct', nov: 'Nov', dec: 'Dec',
  jan: 'Jan', feb: 'Feb', mar: 'Mar', apr: 'Apr', may: 'May', jun: 'Jun',
};

const STATUS_OPTIONS = ['UNSECURED', 'RESEARCH', 'VALIDATED', 'QUALIFIED'] as const;
type Status = typeof STATUS_OPTIONS[number];

type Opportunity = {
  id?: string;
  financialYear: number;
  status: Status;
  projectName: string;
  contractValue: number | null;
  forecastMarginPct: number | null;
  jul: number; aug: number; sep: number; oct: number; nov: number; dec: number;
  jan: number; feb: number; mar: number; apr: number; may: number; jun: number;
  nextYear: number;
  sortOrder: number;
  notes: string | null;
  _isNew?: boolean;
  _delete?: boolean;
};

function toNum(v: unknown): number {
  const n = parseFloat(String(v ?? 0));
  return isNaN(n) ? 0 : n;
}

function fmtCurrency(v: number): string {
  if (v === 0) return '';
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(v);
}

function parseCurrency(s: string): number {
  return parseFloat(s.replace(/[^0-9.-]/g, '')) || 0;
}

function rowTotal(row: Opportunity): number {
  return MONTHS.reduce((s, m) => s + toNum(row[m]), 0) + toNum(row.nextYear);
}

function fromDb(o: Record<string, unknown>): Opportunity {
  return {
    id: o.id as string,
    financialYear: toNum(o.financialYear),
    status: (o.status as Status) ?? 'UNSECURED',
    projectName: (o.projectName as string) ?? '',
    contractValue: o.contractValue != null ? toNum(o.contractValue) : null,
    forecastMarginPct: o.forecastMarginPct != null ? toNum(o.forecastMarginPct) : null,
    jul: toNum(o.jul), aug: toNum(o.aug), sep: toNum(o.sep), oct: toNum(o.oct),
    nov: toNum(o.nov), dec: toNum(o.dec), jan: toNum(o.jan), feb: toNum(o.feb),
    mar: toNum(o.mar), apr: toNum(o.apr), may: toNum(o.may), jun: toNum(o.jun),
    nextYear: toNum(o.nextYear),
    sortOrder: toNum(o.sortOrder),
    notes: (o.notes as string) ?? null,
  };
}

type CellKey = keyof Opportunity;

export default function PlannedWorkClient({
  initialOpportunities,
  defaultFY,
}: {
  initialOpportunities: Record<string, unknown>[];
  defaultFY: number;
}) {
  const router = useRouter();
  const [fy, setFy] = useState(defaultFY);
  const [rows, setRows] = useState<Opportunity[]>(initialOpportunities.map(fromDb));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editCell, setEditCell] = useState<{ rowIdx: number; key: CellKey } | null>(null);
  const editRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  useEffect(() => {
    if (editRef.current) editRef.current.focus();
  }, [editCell]);

  const loadFY = useCallback(async (year: number) => {
    setLoading(true);
    setDirty(false);
    const res = await fetch(`/api/finance/unsecured-opportunities?fy=${year}`);
    const data = await res.json();
    setRows((data as Record<string, unknown>[]).map(fromDb));
    setFy(year);
    setLoading(false);
  }, []);

  function addRow() {
    const newRow: Opportunity = {
      financialYear: fy,
      status: 'UNSECURED',
      projectName: '',
      contractValue: null,
      forecastMarginPct: null,
      jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
      jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
      nextYear: 0,
      sortOrder: rows.length,
      notes: null,
      _isNew: true,
    };
    setRows((prev) => [...prev, newRow]);
    setDirty(true);
    setTimeout(() => {
      setEditCell({ rowIdx: rows.length, key: 'projectName' });
    }, 0);
  }

  function deleteRow(idx: number) {
    if (!confirm('Delete this opportunity? This cannot be undone.')) return;
    setRows((prev) => {
      const next = [...prev];
      if (next[idx].id) {
        next[idx] = { ...next[idx], _delete: true };
      } else {
        next.splice(idx, 1);
      }
      return next;
    });
    setDirty(true);
  }

  function updateCell(idx: number, key: CellKey, value: unknown) {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
    setDirty(true);
  }

  async function saveAll() {
    setSaving(true);
    setSaveError(null);
    const payload = rows.map((r, i) => ({ ...r, sortOrder: i }));
    const res = await fetch('/api/finance/unsecured-opportunities/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setSaveError('Save failed. Please try again.');
      setSaving(false);
      return;
    }
    await loadFY(fy);
    setDirty(false);
    setSaving(false);
    router.refresh();
  }

  const visibleRows = rows.filter((r) => !r._delete);

  const totals = {
    contractValue: visibleRows.reduce((s, r) => s + toNum(r.contractValue), 0),
    ...Object.fromEntries(MONTHS.map((m) => [m, visibleRows.reduce((s, r) => s + toNum(r[m]), 0)])),
    nextYear: visibleRows.reduce((s, r) => s + toNum(r.nextYear), 0),
    grand: visibleRows.reduce((s, r) => s + rowTotal(r), 0),
  };

  function CellInput({ rowIdx, field, type = 'currency' }: { rowIdx: number; field: Month | 'nextYear' | 'contractValue'; type?: 'currency' | 'pct' }) {
    const isEditing = editCell?.rowIdx === rowIdx && editCell?.key === field;
    const val = toNum(rows[rowIdx]?.[field as keyof Opportunity]);

    if (isEditing) {
      return (
        <input
          ref={(el) => { editRef.current = el; }}
          type="number"
          step="any"
          defaultValue={val === 0 ? '' : val}
          onBlur={(e) => {
            updateCell(rowIdx, field as CellKey, parseFloat(e.target.value) || 0);
            setEditCell(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
            if (e.key === 'Escape') { setEditCell(null); }
            if (e.key === 'Tab') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
              const fields: CellKey[] = ['contractValue', 'forecastMarginPct', ...MONTHS, 'nextYear'];
              const fi = fields.indexOf(field as CellKey);
              if (fi < fields.length - 1) setEditCell({ rowIdx, key: fields[fi + 1] });
              else if (rowIdx < visibleRows.length - 1) setEditCell({ rowIdx: rowIdx + 1, key: 'projectName' });
            }
          }}
          className="w-full px-1 py-0.5 text-xs text-right border border-brand rounded outline-none bg-white min-w-[70px]"
        />
      );
    }

    return (
      <button
        onClick={() => setEditCell({ rowIdx, key: field as CellKey })}
        className="w-full text-right text-xs text-zinc-700 hover:bg-blue-50 px-1 py-0.5 rounded min-w-[70px] block"
      >
        {type === 'pct' ? (val === 0 ? '—' : `${(val * 100).toFixed(1)}%`) : (val === 0 ? '—' : fmtCurrency(val))}
      </button>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Unsecured Forecast</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Manually entered unsecured opportunities. Feeds the Unsecured Forecast section of the management report.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && (
            <span className="text-xs text-amber-600 font-medium px-2 py-1 bg-amber-50 rounded border border-amber-200">
              Unsaved changes
            </span>
          )}
          <select
            value={fy}
            onChange={(e) => loadFY(Number(e.target.value))}
            className="text-sm border border-zinc-200 rounded px-2 py-1.5 text-zinc-700"
          >
            {[defaultFY - 1, defaultFY, defaultFY + 1].map((y) => (
              <option key={y} value={y}>FY {y}</option>
            ))}
          </select>
          <button
            onClick={addRow}
            className="px-3 py-1.5 bg-brand text-white text-sm rounded hover:bg-brand/90 font-medium"
          >
            + Add Opportunity
          </button>
        </div>
      </div>

      {saveError && (
        <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded">{saveError}</div>
      )}

      {loading ? (
        <div className="text-sm text-zinc-400 py-8 text-center">Loading…</div>
      ) : (
        <div className="overflow-auto border border-zinc-200 rounded-lg">
          <table className="w-full text-xs min-w-[1600px]">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="text-left px-3 py-2 font-semibold text-zinc-600 w-24">Status</th>
                <th className="text-left px-3 py-2 font-semibold text-zinc-600 min-w-[200px]">Project Name</th>
                <th className="text-right px-2 py-2 font-semibold text-zinc-600 w-[90px]">Contract $</th>
                <th className="text-right px-2 py-2 font-semibold text-zinc-600 w-[70px]">Margin %</th>
                {MONTHS.map((m) => (
                  <th key={m} className="text-right px-1 py-2 font-semibold text-zinc-600 w-[72px]">
                    {MONTH_LABELS[m]}
                  </th>
                ))}
                <th className="text-right px-1 py-2 font-semibold text-zinc-600 w-[80px]">Next Yr</th>
                <th className="text-right px-2 py-2 font-semibold text-zinc-600 w-[90px]">Total</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={18} className="text-center text-zinc-400 py-10 text-sm">
                    No opportunities entered. Click <strong>+ Add Opportunity</strong> to begin.
                  </td>
                </tr>
              )}
              {rows.map((row, realIdx) => {
                if (row._delete) return null;
                return (
                  <tr key={row.id ?? `new-${realIdx}`} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                    {/* Status */}
                    <td className="px-2 py-1">
                      {editCell?.rowIdx === realIdx && editCell?.key === 'status' ? (
                        <select
                          ref={(el) => { editRef.current = el; }}
                          value={row.status}
                          onChange={(e) => updateCell(realIdx, 'status', e.target.value)}
                          onBlur={() => setEditCell(null)}
                          className="text-xs border border-brand rounded px-1 py-0.5 w-full"
                        >
                          {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      ) : (
                        <button
                          onClick={() => setEditCell({ rowIdx: realIdx, key: 'status' })}
                          className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 hover:bg-blue-50 w-full text-left"
                        >
                          {row.status}
                        </button>
                      )}
                    </td>
                    {/* Project Name */}
                    <td className="px-2 py-1">
                      {editCell?.rowIdx === realIdx && editCell?.key === 'projectName' ? (
                        <input
                          ref={(el) => { editRef.current = el; }}
                          type="text"
                          defaultValue={row.projectName}
                          onBlur={(e) => {
                            updateCell(realIdx, 'projectName', e.target.value);
                            setEditCell(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'Tab') {
                              e.preventDefault();
                              (e.target as HTMLInputElement).blur();
                              setEditCell({ rowIdx: realIdx, key: 'contractValue' });
                            }
                            if (e.key === 'Escape') setEditCell(null);
                          }}
                          className="w-full px-1 py-0.5 text-xs border border-brand rounded outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => setEditCell({ rowIdx: realIdx, key: 'projectName' })}
                          className="w-full text-left text-xs text-zinc-800 hover:bg-blue-50 px-1 py-0.5 rounded truncate block"
                        >
                          {row.projectName || <span className="text-zinc-300">Enter name…</span>}
                        </button>
                      )}
                    </td>
                    {/* Contract Value */}
                    <td className="px-1 py-1"><CellInput rowIdx={realIdx} field="contractValue" /></td>
                    {/* Forecast Margin % */}
                    <td className="px-1 py-1">
                      {editCell?.rowIdx === realIdx && editCell?.key === 'forecastMarginPct' ? (
                        <input
                          ref={(el) => { editRef.current = el; }}
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          defaultValue={row.forecastMarginPct != null ? (row.forecastMarginPct * 100).toFixed(1) : ''}
                          placeholder="%"
                          onBlur={(e) => {
                            const pct = parseFloat(e.target.value);
                            updateCell(realIdx, 'forecastMarginPct', isNaN(pct) ? null : pct / 100);
                            setEditCell(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            if (e.key === 'Escape') setEditCell(null);
                            if (e.key === 'Tab') {
                              e.preventDefault();
                              (e.target as HTMLInputElement).blur();
                              setEditCell({ rowIdx: realIdx, key: 'jul' });
                            }
                          }}
                          className="w-full px-1 py-0.5 text-xs text-right border border-brand rounded outline-none bg-white"
                        />
                      ) : (
                        <button
                          onClick={() => setEditCell({ rowIdx: realIdx, key: 'forecastMarginPct' })}
                          className="w-full text-right text-xs text-zinc-700 hover:bg-blue-50 px-1 py-0.5 rounded block"
                        >
                          {row.forecastMarginPct != null ? `${(row.forecastMarginPct * 100).toFixed(1)}%` : '—'}
                        </button>
                      )}
                    </td>
                    {/* Monthly columns */}
                    {MONTHS.map((m) => (
                      <td key={m} className="px-0.5 py-1">
                        <CellInput rowIdx={realIdx} field={m} />
                      </td>
                    ))}
                    {/* Next Year */}
                    <td className="px-0.5 py-1"><CellInput rowIdx={realIdx} field="nextYear" /></td>
                    {/* Row Total */}
                    <td className="px-2 py-1 text-right text-zinc-600 font-medium">
                      {rowTotal(row) === 0 ? '—' : fmtCurrency(rowTotal(row))}
                    </td>
                    {/* Delete */}
                    <td className="px-1 py-1 text-center">
                      <button
                        onClick={() => deleteRow(realIdx)}
                        title="Delete opportunity"
                        className="text-zinc-300 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Totals */}
            <tfoot>
              <tr className="bg-zinc-50 border-t-2 border-zinc-300 font-semibold">
                <td className="px-3 py-2 text-zinc-700 text-xs" colSpan={2}>Totals</td>
                <td className="px-2 py-2 text-right text-xs text-zinc-800">
                  {totals.contractValue === 0 ? '—' : fmtCurrency(totals.contractValue)}
                </td>
                <td />
                {MONTHS.map((m) => (
                  <td key={m} className="px-1 py-2 text-right text-xs text-zinc-800">
                    {(totals as Record<string, number>)[m] === 0 ? '—' : fmtCurrency((totals as Record<string, number>)[m])}
                  </td>
                ))}
                <td className="px-1 py-2 text-right text-xs text-zinc-800">
                  {totals.nextYear === 0 ? '—' : fmtCurrency(totals.nextYear)}
                </td>
                <td className="px-2 py-2 text-right text-xs text-zinc-900">
                  {totals.grand === 0 ? '—' : fmtCurrency(totals.grand)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Save button */}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={saveAll}
          disabled={!dirty || saving}
          className="px-4 py-2 bg-brand text-white text-sm rounded font-medium hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save All'}
        </button>
        {dirty && (
          <button
            onClick={() => loadFY(fy)}
            disabled={saving}
            className="px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700"
          >
            Discard changes
          </button>
        )}
      </div>
    </div>
  );
}
