'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { showToast, ToastContainer } from '@/components/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────

type LineStructure = 'SECTION_HEADER' | 'SUB_HEADING' | 'STANDARD_LINE' | 'NOTE_LINE' | 'PROJECT_SUM_LINE';

type Line = {
  id: string;
  lineStructure: LineStructure;
  lineCode: string | null;
  description: string;
  type: string;
  quantity: number;
  unit: string | null;
  rate: number;
  total: number;
  markupPct: number | null;
  declaredMarginPct: number | null;
  isRisk: boolean;
  isOption: boolean;
  isPcSum: boolean;
  isLockaway: boolean;
  isHidden: boolean;
  notes: string | null;
  tradeSectionId: string | null;
  tradePackageId: string | null;
  tradeSection: { id: string; name: string; code: string | null } | null;
  order: number;
};

type TradeSection = { id: string; name: string; code: string | null; order: number };
type TradePackage = { id: string; name: string };

type Estimate = {
  id: string;
  defaultMarkupPct: number | string;
  costRecoveryPct: number | string;
  targetGpPct: number | string;
  tradeSections: TradeSection[];
  lines: Line[];
  tradePackages: TradePackage[];
};

// ─── Formatting helpers ───────────────────────────────────────────────────────

const AUD = new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (n: number) => AUD.format(n);
const pct = (n: number | null | undefined) => (n != null ? Number(n).toFixed(2) : '');

function calcSell(cost: number, markupPct: number | null, defaultMarkup: number) {
  const m = markupPct != null ? markupPct : defaultMarkup;
  return cost * (1 + m / 100);
}

function calcGp(cost: number, sell: number) {
  return sell > 0 ? ((sell - cost) / sell) * 100 : 0;
}

// ─── Flag row-level border classes ───────────────────────────────────────────

function rowFlagClass(line: Line) {
  if (line.isHidden) return 'opacity-40';
  if (line.isOption) return 'border-l-2 border-l-blue-400';
  if (line.isRisk) return 'border-l-2 border-l-amber-400';
  if (line.isPcSum) return 'border-l-2 border-l-purple-400';
  if (line.isLockaway) return 'border-l-2 border-l-[#1e3a5f]';
  return '';
}

// ─── Inline cell ─────────────────────────────────────────────────────────────

function InlineCell({
  value,
  type = 'text',
  align = 'left',
  className = '',
  onCommit,
}: {
  value: string;
  type?: 'text' | 'number';
  align?: 'left' | 'right';
  className?: string;
  onCommit: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setLocal(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { setEditing(false); onCommit(local); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); setEditing(false); onCommit(local); }
          if (e.key === 'Escape') { setEditing(false); setLocal(value); }
        }}
        className={`w-full border border-brand/50 rounded px-1 py-0.5 text-sm outline-none bg-white ${align === 'right' ? 'text-right' : ''} ${className}`}
      />
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className={`cursor-text min-h-[1.5rem] rounded px-1 py-0.5 hover:bg-zinc-100 text-sm ${align === 'right' ? 'text-right' : ''} ${className}`}
    >
      {value}
    </div>
  );
}

// ─── Context menu ─────────────────────────────────────────────────────────────

type ContextAction = 'insert-above' | 'insert-below' | 'duplicate' | 'move-up' | 'move-down' | 'delete';

function ContextMenu({
  x, y, onAction, onClose,
}: {
  x: number; y: number;
  onAction: (a: ContextAction) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const items: { label: string; action: ContextAction; danger?: boolean }[] = [
    { label: 'Insert line above', action: 'insert-above' },
    { label: 'Insert line below', action: 'insert-below' },
    { label: 'Duplicate', action: 'duplicate' },
    { label: 'Move up', action: 'move-up' },
    { label: 'Move down', action: 'move-down' },
    { label: 'Delete', action: 'delete', danger: true },
  ];

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left: x, top: y, zIndex: 9999 }}
      className="bg-white border border-zinc-200 rounded-md shadow-lg py-1 min-w-[160px]"
    >
      {items.map((item) => (
        <button
          key={item.action}
          onClick={() => { onAction(item.action); onClose(); }}
          className={`w-full text-left px-4 py-1.5 text-sm hover:bg-zinc-50 ${item.danger ? 'text-red-600' : 'text-zinc-700'}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ─── Standard Line Row ────────────────────────────────────────────────────────

function StandardRow({
  line,
  estimateId,
  defaultMarkupPct,
  packages,
  onPatch,
  onContextMenu,
}: {
  line: Line;
  estimateId: string;
  defaultMarkupPct: number;
  packages: TradePackage[];
  onPatch: (id: string, patch: Partial<Line>) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback((patch: Partial<Line>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onPatch(line.id, patch);
    timerRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/leads/${estimateId}/cost-plan/lines/${line.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
      } catch {
        showToast('Save failed');
      }
    }, 500);
  }, [line.id, estimateId, onPatch]);

  const cost = Number(line.quantity) * Number(line.rate);
  const sell = calcSell(cost, line.markupPct, defaultMarkupPct);
  const gp = calcGp(cost, sell);

  const isProjectSum = line.lineStructure === 'PROJECT_SUM_LINE';

  return (
    <tr
      className={`border-b border-zinc-100 hover:bg-zinc-50/50 group ${rowFlagClass(line)} ${isProjectSum ? 'bg-blue-50/20' : ''}`}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, line.id); }}
    >
      {/* Code — sticky */}
      <td className="sticky left-0 bg-inherit px-2 py-1 text-xs text-zinc-400 whitespace-nowrap z-10 w-20">
        <InlineCell
          value={line.lineCode ?? ''}
          onCommit={(v) => save({ lineCode: v || null })}
          className="text-zinc-400"
        />
      </td>
      {/* Description */}
      <td className="px-2 py-1 min-w-[200px]">
        <InlineCell
          value={line.description}
          onCommit={(v) => save({ description: v })}
          className={isProjectSum ? 'font-medium text-blue-800' : ''}
        />
      </td>
      {/* Unit */}
      <td className="px-1 py-1 w-16">
        <InlineCell
          value={line.unit ?? ''}
          onCommit={(v) => save({ unit: v || null })}
          className="text-zinc-500"
        />
      </td>
      {/* Qty */}
      <td className="px-1 py-1 w-20">
        <InlineCell
          value={String(Number(line.quantity))}
          type="number"
          align="right"
          onCommit={(v) => save({ quantity: Number(v) || 0 })}
        />
      </td>
      {/* Rate */}
      <td className="px-1 py-1 w-24">
        <InlineCell
          value={String(Number(line.rate))}
          type="number"
          align="right"
          onCommit={(v) => save({ rate: Number(v) || 0 })}
        />
      </td>
      {/* Total Cost */}
      <td className="px-2 py-1 w-28 text-right text-sm font-medium text-zinc-800 tabular-nums">
        {fmt(cost)}
      </td>
      {/* Markup % */}
      <td className="px-1 py-1 w-20">
        <InlineCell
          value={line.markupPct != null ? String(Number(line.markupPct)) : ''}
          type="number"
          align="right"
          onCommit={(v) => save({ markupPct: v !== '' ? Number(v) : null })}
          className="text-zinc-500"
        />
      </td>
      {/* Declared Margin % */}
      <td className="px-1 py-1 w-20">
        <InlineCell
          value={line.declaredMarginPct != null ? String(Number(line.declaredMarginPct)) : ''}
          type="number"
          align="right"
          onCommit={(v) => save({ declaredMarginPct: v !== '' ? Number(v) : null })}
          className="text-zinc-500"
        />
      </td>
      {/* Total Sell */}
      <td className="px-2 py-1 w-28 text-right text-sm text-zinc-700 tabular-nums">
        {fmt(sell)}
      </td>
      {/* GP% */}
      <td className={`px-2 py-1 w-20 text-right text-sm font-medium tabular-nums ${gp >= 20 ? 'text-green-600' : gp >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
        {gp.toFixed(1)}%
      </td>
      {/* Flags */}
      <td className="px-2 py-1 w-24">
        <div className="flex flex-wrap gap-0.5">
          {line.isOption && <span className="px-1 py-0.5 text-[9px] font-bold bg-blue-100 text-blue-700 rounded">OPT</span>}
          {line.isRisk && <span className="px-1 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 rounded">R&O</span>}
          {line.isHidden && <span className="px-1 py-0.5 text-[9px] font-bold bg-zinc-100 text-zinc-400 rounded">HID</span>}
          {line.isPcSum && <span className="px-1 py-0.5 text-[9px] font-bold bg-purple-100 text-purple-700 rounded">PC</span>}
          {line.isLockaway && <span className="px-1 py-0.5 text-[9px] font-bold bg-blue-100 text-[#1e3a5f] rounded">LOCK</span>}
        </div>
      </td>
      {/* Trade Package */}
      <td className="px-1 py-1 w-32">
        <select
          value={line.tradePackageId ?? ''}
          onChange={(e) => save({ tradePackageId: e.target.value || null })}
          className="w-full text-xs border border-transparent rounded px-1 py-0.5 hover:border-zinc-200 bg-transparent focus:outline-none focus:border-zinc-300"
        >
          <option value="">—</option>
          {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CostPlanClient({
  estimate,
}: {
  estimate: Estimate;
  orgTradeSections: TradeSection[];
}) {
  const [lines, setLines] = useState<Line[]>(() =>
    estimate.lines.map((l) => ({
      ...l,
      lineStructure: (l as Line).lineStructure ?? 'STANDARD_LINE',
      lineCode: (l as Line).lineCode ?? null,
      markupPct: (l as Line).markupPct != null ? Number((l as Line).markupPct) : null,
      declaredMarginPct: l.declaredMarginPct != null ? Number(l.declaredMarginPct) : null,
      quantity: Number(l.quantity),
      rate: Number(l.rate),
      total: Number(l.total),
      order: (l as Line).order ?? 0,
    }))
  );

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [rolledUp, setRolledUp] = useState(false);
  const [adding, setAdding] = useState<string | null>(null); // sectionId being added to
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; lineId: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const defaultMarkup = Number(estimate.defaultMarkupPct);
  const costRecovery = Number(estimate.costRecoveryPct);

  // Patch a line in local state
  const patchLine = useCallback((id: string, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l) => {
      if (l.id !== id) return l;
      const updated = { ...l, ...patch };
      updated.total = updated.quantity * updated.rate;
      return updated;
    }));
  }, []);

  // ── Context menu actions ──────────────────────────────────────────────────

  async function handleContextAction(action: ContextAction, lineId: string) {
    const idx = lines.findIndex((l) => l.id === lineId);
    if (idx === -1) return;
    const line = lines[idx];

    if (action === 'delete') {
      if (!confirm('Delete this line?')) return;
      setSaving(true);
      try {
        await fetch(`/api/leads/${estimate.id}/cost-plan/lines/${lineId}`, { method: 'DELETE' });
        setLines((prev) => prev.filter((l) => l.id !== lineId));
      } catch { showToast('Delete failed'); }
      setSaving(false);
      return;
    }

    if (action === 'duplicate') {
      setSaving(true);
      try {
        const res = await fetch(`/api/leads/${estimate.id}/cost-plan/lines`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...line,
            id: undefined,
            order: line.order + 0.5,
            lineCode: line.lineCode ? `${line.lineCode}-copy` : null,
          }),
        });
        if (res.ok) {
          const newLine = await res.json();
          setLines((prev) => {
            const next = [...prev];
            next.splice(idx + 1, 0, { ...newLine, quantity: Number(newLine.quantity), rate: Number(newLine.rate), total: Number(newLine.total), markupPct: newLine.markupPct != null ? Number(newLine.markupPct) : null, declaredMarginPct: newLine.declaredMarginPct != null ? Number(newLine.declaredMarginPct) : null });
            return next;
          });
        }
      } catch { showToast('Duplicate failed'); }
      setSaving(false);
      return;
    }

    if (action === 'insert-above' || action === 'insert-below') {
      setSaving(true);
      try {
        const insertOrder = action === 'insert-above' ? line.order - 0.5 : line.order + 0.5;
        const res = await fetch(`/api/leads/${estimate.id}/cost-plan/lines`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tradeSectionId: line.tradeSectionId,
            lineStructure: 'STANDARD_LINE',
            description: 'New line',
            type: 'MATERIAL',
            quantity: 0,
            rate: 0,
            order: insertOrder,
          }),
        });
        if (res.ok) {
          const newLine = await res.json();
          const insertIdx = action === 'insert-above' ? idx : idx + 1;
          setLines((prev) => {
            const next = [...prev];
            next.splice(insertIdx, 0, { ...newLine, quantity: 0, rate: 0, total: 0, markupPct: null, declaredMarginPct: null });
            return next;
          });
        }
      } catch { showToast('Insert failed'); }
      setSaving(false);
      return;
    }

    if (action === 'move-up' || action === 'move-down') {
      const swapIdx = action === 'move-up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= lines.length) return;
      const next = [...lines];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      setLines(next);
      // fire-and-forget order updates
      fetch(`/api/leads/${estimate.id}/cost-plan/lines/${lines[idx].id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: lines[swapIdx].order }),
      });
      fetch(`/api/leads/${estimate.id}/cost-plan/lines/${lines[swapIdx].id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: lines[idx].order }),
      });
    }
  }

  // ── Quick add line ────────────────────────────────────────────────────────

  async function handleAddLine(sectionId: string | null) {
    setSaving(true);
    try {
      const sectionLines = lines.filter((l) => l.tradeSectionId === sectionId);
      const maxOrder = sectionLines.reduce((m, l) => Math.max(m, l.order), -1);
      const res = await fetch(`/api/leads/${estimate.id}/cost-plan/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeSectionId: sectionId,
          lineStructure: 'STANDARD_LINE',
          description: 'New line',
          type: 'MATERIAL',
          quantity: 0,
          rate: 0,
          markupPct: defaultMarkup,
          order: maxOrder + 1,
        }),
      });
      if (res.ok) {
        const newLine = await res.json();
        setLines((prev) => [...prev, { ...newLine, quantity: 0, rate: 0, total: 0, markupPct: defaultMarkup, declaredMarginPct: null }]);
      }
    } catch { showToast('Add failed'); }
    setSaving(false);
    setAdding(null);
  }

  // ── Summary totals ────────────────────────────────────────────────────────

  const activeLines = lines.filter((l) =>
    (l.lineStructure === 'STANDARD_LINE' || l.lineStructure === 'PROJECT_SUM_LINE') &&
    !l.isOption && !l.isLockaway && !l.isHidden
  );
  const totalCost = activeLines.reduce((s, l) => s + l.total, 0);
  const totalSell = activeLines.reduce((s, l) => s + calcSell(l.total, l.markupPct, defaultMarkup), 0);
  const grossRevenue = totalSell * (1 + costRecovery / 100);
  const overallGp = calcGp(totalCost, grossRevenue);

  function toggleCollapse(sectionId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  // ── Column header ─────────────────────────────────────────────────────────

  const TH = ({ children, align = 'left', width }: { children: React.ReactNode; align?: string; width?: string }) => (
    <th className={`px-2 py-2.5 text-${align} text-[11px] font-semibold text-zinc-500 uppercase tracking-wide whitespace-nowrap ${width ?? ''}`}>
      {children}
    </th>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ToastContainer />

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-100 bg-white shrink-0">
        <div className="flex items-center gap-1 bg-zinc-100 rounded-md p-0.5">
          <button
            onClick={() => setRolledUp(false)}
            className={`px-3 py-1 text-xs rounded transition-colors ${!rolledUp ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            Expanded
          </button>
          <button
            onClick={() => setRolledUp(true)}
            className={`px-3 py-1 text-xs rounded transition-colors ${rolledUp ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            Rolled Up
          </button>
        </div>
        {saving && <span className="text-xs text-zinc-400 animate-pulse">Saving…</span>}
        <div className="ml-auto flex items-center gap-5 text-sm">
          <span className="text-zinc-500">Cost <strong className="text-zinc-900 tabular-nums">{fmt(totalCost)}</strong></span>
          <span className="text-zinc-500">Sell <strong className="text-zinc-700 tabular-nums">{fmt(totalSell)}</strong></span>
          <span className={`font-semibold tabular-nums ${overallGp >= Number(estimate.targetGpPct) ? 'text-green-600' : overallGp >= 15 ? 'text-amber-600' : 'text-red-600'}`}>
            GP {overallGp.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse" style={{ minWidth: 1100 }}>
          <thead className="sticky top-0 bg-white z-20 border-b border-zinc-200">
            <tr>
              <TH width="w-20">Code</TH>
              <TH>Description</TH>
              <TH width="w-16">Unit</TH>
              <TH align="right" width="w-20">Qty</TH>
              <TH align="right" width="w-24">Rate</TH>
              <TH align="right" width="w-28">Total Cost</TH>
              <TH align="right" width="w-20">Mkup %</TH>
              <TH align="right" width="w-20">DM %</TH>
              <TH align="right" width="w-28">Total Sell</TH>
              <TH align="right" width="w-20">GP %</TH>
              <TH width="w-24">Flags</TH>
              <TH width="w-32">Trade Pkg</TH>
            </tr>
          </thead>
          <tbody>
            {estimate.tradeSections.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-16 text-center text-sm text-zinc-400">
                  No trade sections yet.
                </td>
              </tr>
            )}

            {estimate.tradeSections.map((section) => {
              const sectionLines = lines.filter((l) => l.tradeSectionId === section.id);
              const sectionCost = sectionLines
                .filter((l) => (l.lineStructure === 'STANDARD_LINE' || l.lineStructure === 'PROJECT_SUM_LINE') && !l.isOption && !l.isLockaway && !l.isHidden)
                .reduce((s, l) => s + l.total, 0);
              const sectionSell = sectionLines
                .filter((l) => (l.lineStructure === 'STANDARD_LINE' || l.lineStructure === 'PROJECT_SUM_LINE') && !l.isOption && !l.isLockaway && !l.isHidden)
                .reduce((s, l) => s + calcSell(l.total, l.markupPct, defaultMarkup), 0);
              const sectionGp = calcGp(sectionCost, sectionSell);
              const isCollapsed = collapsed.has(section.id);

              return (
                <tbody key={section.id}>
                  {/* Section header row */}
                  <tr className="bg-[#1e3a5f] text-white">
                    <td className="sticky left-0 bg-[#1e3a5f] px-2 py-2 z-10">
                      <button
                        onClick={() => toggleCollapse(section.id)}
                        className="text-blue-200 hover:text-white text-xs mr-1 w-4 inline-block text-center"
                        title={isCollapsed ? 'Expand' : 'Collapse'}
                      >
                        {isCollapsed ? '▶' : '▼'}
                      </button>
                      <span className="text-blue-200 text-[11px] font-mono">{section.code}</span>
                    </td>
                    <td colSpan={4} className="px-2 py-2">
                      <span className="text-sm font-semibold tracking-wide">{section.name}</span>
                    </td>
                    <td className="px-2 py-2 text-right text-sm font-bold tabular-nums">{fmt(sectionCost)}</td>
                    <td colSpan={2}></td>
                    <td className="px-2 py-2 text-right text-sm font-medium tabular-nums text-blue-200">{fmt(sectionSell)}</td>
                    <td className={`px-2 py-2 text-right text-sm font-bold tabular-nums ${sectionGp >= Number(estimate.targetGpPct) ? 'text-green-300' : 'text-amber-300'}`}>
                      {sectionGp.toFixed(1)}%
                    </td>
                    <td colSpan={2}></td>
                  </tr>

                  {/* Lines */}
                  {!isCollapsed && !rolledUp && sectionLines.map((line) => {
                    if (line.lineStructure === 'SECTION_HEADER') {
                      return (
                        <tr key={line.id} className="bg-zinc-800 text-white" onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, lineId: line.id }); }}>
                          <td className="sticky left-0 bg-zinc-800 px-2 py-1.5 z-10 text-xs text-zinc-400 font-mono">
                            {line.lineCode}
                          </td>
                          <td colSpan={11} className="px-2 py-1.5 text-sm font-bold tracking-wide">
                            {line.description}
                          </td>
                        </tr>
                      );
                    }

                    if (line.lineStructure === 'SUB_HEADING') {
                      return (
                        <tr key={line.id} className="bg-zinc-50" onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, lineId: line.id }); }}>
                          <td className="sticky left-0 bg-zinc-50 px-2 py-1 z-10 text-xs text-zinc-400"></td>
                          <td colSpan={11} className="px-2 py-1 text-sm italic text-zinc-500 font-medium pl-4">
                            {line.description}
                          </td>
                        </tr>
                      );
                    }

                    if (line.lineStructure === 'NOTE_LINE') {
                      return (
                        <tr key={line.id} className="bg-white" onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, lineId: line.id }); }}>
                          <td className="sticky left-0 bg-white px-2 py-0.5 z-10 text-xs text-zinc-300"></td>
                          <td colSpan={11} className="px-2 py-0.5 text-xs italic text-zinc-400 pl-8">
                            {line.description}
                          </td>
                        </tr>
                      );
                    }

                    // STANDARD_LINE and PROJECT_SUM_LINE
                    return (
                      <StandardRow
                        key={line.id}
                        line={line}
                        estimateId={estimate.id}
                        defaultMarkupPct={defaultMarkup}
                        packages={estimate.tradePackages}
                        onPatch={patchLine}
                        onContextMenu={(e, id) => setCtxMenu({ x: e.clientX, y: e.clientY, lineId: id })}
                      />
                    );
                  })}

                  {/* Add line row (expanded mode only) */}
                  {!isCollapsed && !rolledUp && (
                    <tr>
                      <td colSpan={12} className="px-2 py-1 border-b border-zinc-100">
                        {adding === section.id ? (
                          <span className="text-xs text-zinc-400 animate-pulse">Adding…</span>
                        ) : (
                          <button
                            onClick={() => { setAdding(section.id); handleAddLine(section.id); }}
                            className="text-xs text-brand hover:underline"
                          >
                            + Add line
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </tbody>

          {/* Footer */}
          <tfoot className="sticky bottom-0 bg-white border-t-2 border-zinc-300 z-20">
            <tr className="bg-zinc-50">
              <td colSpan={5} className="px-3 py-3 text-sm font-semibold text-zinc-700 text-right">Total</td>
              <td className="px-2 py-3 text-right text-sm font-bold text-zinc-900 tabular-nums">{fmt(totalCost)}</td>
              <td colSpan={2}></td>
              <td className="px-2 py-3 text-right text-sm font-bold text-zinc-700 tabular-nums">{fmt(totalSell)}</td>
              <td className={`px-2 py-3 text-right text-sm font-bold tabular-nums ${overallGp >= Number(estimate.targetGpPct) ? 'text-green-600' : overallGp >= 15 ? 'text-amber-600' : 'text-red-600'}`}>
                {overallGp.toFixed(1)}%
              </td>
              <td colSpan={2}></td>
            </tr>
            <tr>
              <td colSpan={5} className="px-3 py-1.5 text-xs text-zinc-400 text-right">
                Gross Revenue (+{Number(estimate.costRecoveryPct).toFixed(2)}% recovery)
              </td>
              <td colSpan={3}></td>
              <td className="px-2 py-1.5 text-right text-xs text-zinc-500 tabular-nums">{fmt(grossRevenue)}</td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onAction={(action) => handleContextAction(action, ctxMenu.lineId)}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}
