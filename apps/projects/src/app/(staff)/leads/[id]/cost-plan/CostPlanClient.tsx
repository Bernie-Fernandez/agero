'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { showToast, ToastContainer } from '@/components/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────

type LineStructure = 'SECTION_HEADER' | 'SUB_HEADING' | 'STANDARD_LINE' | 'NOTE_LINE' | 'PROJECT_SUM_LINE';

type LineQty = { id: string; label: string; quantity: number };

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
  quantities: LineQty[];
  order: number;
};

type TradeSection = { id: string; name: string; code: string | null; order: number };
type Area = { id: string; name: string; order: number };
type TradePackage = { id: string; name: string };

type Estimate = {
  id: string;
  defaultMarkupPct: number | string;
  costRecoveryPct: number | string;
  targetGpPct: number | string;
  minGpPct: number | string;
  tradeSections: TradeSection[];
  areas: Area[];
  lines: Line[];
  tradePackages: TradePackage[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const UNITS = ['LS', 'EA', 'HRS', 'M2', 'LM', 'MTH', 'WKS', 'SET', 'NOTE', 'M3', 'T', 'KG', 'DAY'];

function calcSell(cost: number, markupPct: number | null, defaultMarkup: number) {
  const m = markupPct != null ? markupPct : defaultMarkup;
  return cost * (1 + m / 100);
}
function calcGp(cost: number, sell: number) {
  return sell > 0 ? ((sell - cost) / sell) * 100 : 0;
}

const AUD = new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (n: number) => AUD.format(n);

function getTotalQty(line: Line): number {
  if (line.quantities.length > 0) return line.quantities.reduce((s, q) => s + q.quantity, 0);
  return Number(line.quantity);
}

function getAreaQty(line: Line, areaName: string): number {
  const found = line.quantities.find((q) => q.label === areaName);
  return found ? found.quantity : 0;
}

// Row-level flag classes
function rowFlagCls(line: Line) {
  if (line.isHidden) return 'opacity-40';
  if (line.isOption) return 'border-l-[3px] border-l-blue-400';
  if (line.isRisk) return 'border-l-[3px] border-l-amber-400';
  if (line.isPcSum) return 'border-l-[3px] border-l-purple-500';
  if (line.isLockaway) return 'border-l-[3px] border-l-[#1e3a5f]';
  return '';
}

// ─── Inline Cell ──────────────────────────────────────────────────────────────

interface InlineCellProps {
  value: string;
  type?: 'text' | 'number';
  align?: 'left' | 'right';
  className?: string;
  placeholder?: string;
  cellId?: string;
  onCommit: (v: string) => void;
  onTabNext?: () => void;
  onEnterNext?: () => void;
}

function InlineCell({ value, type = 'text', align = 'left', className = '', placeholder, cellId, onCommit, onTabNext, onEnterNext }: InlineCellProps) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!editing) setLocal(value); }, [value, editing]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    if (local !== value) onCommit(local);
  }, [local, value, onCommit]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        data-cell-id={cellId}
        type={type}
        value={local}
        placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Tab') { e.preventDefault(); commit(); onTabNext?.(); }
          else if (e.key === 'Enter') { e.preventDefault(); commit(); onEnterNext?.(); }
          else if (e.key === 'Escape') { setEditing(false); setLocal(value); }
        }}
        className={`w-full border border-brand/50 rounded px-1 py-0.5 text-sm outline-none bg-white ${align === 'right' ? 'text-right' : ''} ${className}`}
      />
    );
  }

  return (
    <div
      data-cell-id={cellId}
      onClick={() => setEditing(true)}
      className={`cursor-text min-h-[1.5rem] rounded px-1 py-0.5 hover:bg-zinc-100 text-sm ${align === 'right' ? 'text-right' : ''} ${className}`}
    >
      {value || <span className="text-zinc-300">{placeholder}</span>}
    </div>
  );
}

// ─── Unit Select Cell ──────────────────────────────────────────────────────────

function UnitCell({ value, onCommit }: { value: string | null; onCommit: (v: string | null) => void }) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onCommit(e.target.value || null)}
      className="w-full text-xs border border-transparent rounded px-1 py-0.5 bg-transparent hover:border-zinc-200 focus:outline-none focus:border-zinc-300 focus:bg-white"
    >
      <option value="">—</option>
      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
    </select>
  );
}

// ─── Context Menu ──────────────────────────────────────────────────────────────

type InsertAction =
  | 'insert-std-above' | 'insert-std-below'
  | 'insert-sub-above' | 'insert-note-below'
  | 'insert-ro-below' | 'insert-opt-below'
  | 'duplicate' | 'move-up' | 'move-down' | 'delete';

function ContextMenu({ x, y, onAction, onClose }: { x: number; y: number; onAction: (a: InsertAction) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  const items: { label: string; action: InsertAction; separator?: boolean; danger?: boolean }[] = [
    { label: 'Insert Standard Line above', action: 'insert-std-above' },
    { label: 'Insert Standard Line below', action: 'insert-std-below' },
    { label: 'Insert Sub-heading above', action: 'insert-sub-above', separator: true },
    { label: 'Insert Note Line below', action: 'insert-note-below' },
    { label: 'Insert R&O Line below', action: 'insert-ro-below' },
    { label: 'Insert Option Line below', action: 'insert-opt-below', separator: true },
    { label: 'Duplicate', action: 'duplicate' },
    { label: 'Move up', action: 'move-up' },
    { label: 'Move down', action: 'move-down', separator: true },
    { label: 'Delete', action: 'delete', danger: true },
  ];

  return (
    <div ref={ref} style={{ position: 'fixed', left: x, top: y, zIndex: 9999 }} className="bg-white border border-zinc-200 rounded-lg shadow-xl py-1 min-w-[200px]">
      {items.map((item) => (
        <div key={item.action}>
          {item.separator && <div className="my-1 border-t border-zinc-100" />}
          <button
            onClick={() => { onAction(item.action); onClose(); }}
            className={`w-full text-left px-4 py-1.5 text-sm hover:bg-zinc-50 ${item.danger ? 'text-red-600' : 'text-zinc-700'}`}
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Standard / Project Sum Row ────────────────────────────────────────────────

function StandardRow({
  line, estimateId, defaultMarkupPct, areas, packages,
  onPatch, onContextMenu, onEnterDown,
}: {
  line: Line;
  estimateId: string;
  defaultMarkupPct: number;
  areas: Area[];
  packages: TradePackage[];
  onPatch: (id: string, patch: Partial<Line>) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onEnterDown?: (lineId: string, col: string) => void;
}) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debounce = useCallback((patch: Partial<Line>) => {
    onPatch(line.id, patch);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/leads/${estimateId}/cost-plan/lines/${line.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!res.ok) showToast('Save failed');
      } catch { showToast('Save failed'); }
    }, 500);
  }, [line.id, estimateId, onPatch]);

  const saveQty = useCallback((areaName: string, qty: number) => {
    // Update local state
    const newQtys = [...line.quantities];
    const idx = newQtys.findIndex((q) => q.label === areaName);
    if (idx >= 0) {
      if (qty === 0) newQtys.splice(idx, 1);
      else newQtys[idx] = { ...newQtys[idx], quantity: qty };
    } else if (qty !== 0) {
      newQtys.push({ id: `tmp-${Date.now()}`, label: areaName, quantity: qty });
    }
    const newTotalQty = newQtys.reduce((s, q) => s + q.quantity, 0);
    onPatch(line.id, { quantities: newQtys, quantity: newTotalQty, total: newTotalQty * Number(line.rate) });

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch(`/api/leads/${estimateId}/cost-plan/lines/${line.id}/quantities`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([{ label: areaName, quantity: qty }]),
        });
      } catch { showToast('Save failed'); }
    }, 500);
  }, [line, estimateId, onPatch]);

  const totalQty = getTotalQty(line);
  const cost = totalQty * Number(line.rate);
  const sell = calcSell(cost, line.markupPct, defaultMarkupPct);
  const gp = calcGp(cost, sell);
  const isPS = line.lineStructure === 'PROJECT_SUM_LINE';

  return (
    <tr
      className={`border-b border-zinc-100 hover:bg-zinc-50/60 group ${rowFlagCls(line)} ${isPS ? 'bg-blue-50/30' : ''}`}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, line.id); }}
    >
      {/* Line code — sticky left */}
      <td className="sticky left-0 bg-inherit z-10 px-2 py-1 w-[72px] min-w-[72px]">
        <InlineCell value={line.lineCode ?? ''} onCommit={(v) => debounce({ lineCode: v || null })} className="text-zinc-400 font-mono text-xs" cellId={`${line.id}-code`} />
      </td>
      {/* Description */}
      <td className="px-2 py-1 min-w-[200px]">
        <InlineCell
          value={line.description}
          placeholder="Description"
          onCommit={(v) => debounce({ description: v })}
          className={isPS ? 'font-semibold text-blue-800' : ''}
          cellId={`${line.id}-desc`}
          onTabNext={() => document.querySelector<HTMLElement>(`[data-cell-id="${line.id}-unit"]`)?.click()}
          onEnterNext={() => onEnterDown?.(line.id, 'desc')}
        />
      </td>
      {/* Unit */}
      <td className="px-1 py-1 w-[70px] min-w-[70px]">
        <div data-cell-id={`${line.id}-unit`}>
          <UnitCell value={line.unit} onCommit={(v) => debounce({ unit: v })} />
        </div>
      </td>
      {/* Per-area qty columns */}
      {areas.length > 0 ? areas.map((area) => (
        <td key={area.id} className="px-1 py-1 w-[72px] min-w-[72px]">
          <InlineCell
            value={String(getAreaQty(line, area.name) || '')}
            type="number"
            align="right"
            placeholder="0"
            onCommit={(v) => saveQty(area.name, Number(v) || 0)}
            cellId={`${line.id}-qty-${area.id}`}
          />
        </td>
      )) : (
        <td className="px-1 py-1 w-[80px] min-w-[80px]">
          <InlineCell
            value={String(Number(line.quantity) || '')}
            type="number"
            align="right"
            placeholder="0"
            onCommit={(v) => debounce({ quantity: Number(v) || 0 })}
            cellId={`${line.id}-qty-0`}
          />
        </td>
      )}
      {/* Total Qty */}
      {areas.length > 0 && (
        <td className="px-2 py-1 w-[72px] text-right text-sm text-zinc-500 tabular-nums">{totalQty || ''}</td>
      )}
      {/* Unit Rate */}
      <td className="px-1 py-1 w-[96px] min-w-[96px]">
        <InlineCell
          value={Number(line.rate) ? String(Number(line.rate)) : ''}
          type="number"
          align="right"
          placeholder="0.00"
          onCommit={(v) => debounce({ rate: Number(v) || 0 })}
          cellId={`${line.id}-rate`}
        />
      </td>
      {/* Total Cost */}
      <td className="px-2 py-1 w-[100px] text-right text-sm font-medium text-zinc-800 tabular-nums">
        {cost > 0 ? fmt(cost) : <span className="text-zinc-300">—</span>}
      </td>
      {/* Markup % */}
      <td className="px-1 py-1 w-[68px] min-w-[68px]">
        <InlineCell
          value={line.markupPct != null ? String(Number(line.markupPct)) : ''}
          type="number"
          align="right"
          placeholder={String(defaultMarkupPct)}
          onCommit={(v) => debounce({ markupPct: v !== '' ? Number(v) : null })}
          cellId={`${line.id}-mkup`}
          className="text-zinc-500"
        />
      </td>
      {/* Declared Margin % */}
      <td className="px-1 py-1 w-[60px] min-w-[60px]">
        <InlineCell
          value={line.declaredMarginPct != null ? String(Number(line.declaredMarginPct)) : ''}
          type="number"
          align="right"
          placeholder="—"
          onCommit={(v) => debounce({ declaredMarginPct: v !== '' ? Number(v) : null })}
          cellId={`${line.id}-dm`}
          className="text-blue-600 text-xs"
        />
      </td>
      {/* Total Sell */}
      <td className="px-2 py-1 w-[100px] text-right text-sm text-zinc-700 tabular-nums">
        {sell > 0 ? fmt(sell) : <span className="text-zinc-300">—</span>}
      </td>
      {/* GP% */}
      <td className={`px-2 py-1 w-[64px] text-right text-sm font-semibold tabular-nums ${sell > 0 ? (gp >= 20 ? 'text-green-600' : gp >= 10 ? 'text-amber-600' : 'text-red-500') : 'text-zinc-300'}`}>
        {sell > 0 ? `${gp.toFixed(1)}%` : '—'}
      </td>
      {/* Flags */}
      <td className="px-2 py-1 w-[88px]">
        <div className="flex flex-wrap gap-0.5">
          {line.isOption && <FlagBadge label="OPT" cls="bg-blue-100 text-blue-700" onClick={() => debounce({ isOption: false })} />}
          {line.isRisk && <FlagBadge label="R&O" cls="bg-amber-100 text-amber-700" onClick={() => debounce({ isRisk: false })} />}
          {line.isHidden && <FlagBadge label="HID" cls="bg-zinc-100 text-zinc-400" onClick={() => debounce({ isHidden: false })} />}
          {line.isPcSum && <FlagBadge label="PC" cls="bg-purple-100 text-purple-700" onClick={() => debounce({ isPcSum: false })} />}
          {line.isLockaway && <FlagBadge label="LOCK" cls="bg-blue-50 text-[#1e3a5f]" onClick={() => debounce({ isLockaway: false })} />}
          {!line.isOption && !line.isRisk && !line.isHidden && !line.isPcSum && !line.isLockaway && (
            <FlagMenu onSelect={(flag) => debounce({ [flag]: true })} />
          )}
        </div>
      </td>
      {/* Trade Package */}
      <td className="px-1 py-1 w-[120px]">
        <select
          value={line.tradePackageId ?? ''}
          onChange={(e) => debounce({ tradePackageId: e.target.value || null })}
          className="w-full text-xs border border-transparent rounded px-1 py-0.5 bg-transparent hover:border-zinc-200 focus:outline-none focus:border-zinc-300 focus:bg-white"
        >
          <option value="">—</option>
          {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </td>
    </tr>
  );
}

function FlagBadge({ label, cls, onClick }: { label: string; cls: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Click to remove flag"
      className={`px-1 py-0.5 text-[9px] font-bold rounded ${cls} hover:opacity-70`}
    >
      {label}
    </button>
  );
}

function FlagMenu({ onSelect }: { onSelect: (flag: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="text-zinc-300 hover:text-zinc-500 text-xs px-1 rounded">+</button>
      {open && (
        <div className="absolute left-0 top-5 bg-white border border-zinc-200 rounded shadow-lg py-1 z-30 min-w-[80px]">
          {[['isOption', 'OPT'], ['isRisk', 'R&O'], ['isHidden', 'HID'], ['isPcSum', 'PC'], ['isLockaway', 'LOCK']].map(([flag, lbl]) => (
            <button key={flag} onClick={() => { onSelect(flag); setOpen(false); }} className="w-full text-left px-3 py-1 text-xs hover:bg-zinc-50">{lbl}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type FilterMode = 'all' | 'active';

export default function CostPlanClient({ estimate }: { estimate: Estimate; orgTradeSections: TradeSection[] }) {
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
      quantities: ((l as Line).quantities ?? []).map((q) => ({ ...q, quantity: Number(q.quantity) })),
      order: (l as Line).order ?? 0,
    }))
  );

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; lineId: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const defaultMarkup = Number(estimate.defaultMarkupPct);
  const costRecovery = Number(estimate.costRecoveryPct);
  const targetGp = Number(estimate.targetGpPct);
  const minGp = Number(estimate.minGpPct);
  const areas = estimate.areas ?? [];

  const patchLine = useCallback((id: string, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l) => {
      if (l.id !== id) return l;
      const up = { ...l, ...patch };
      const tq = getTotalQty(up);
      up.total = tq * Number(up.rate);
      return up;
    }));
  }, []);

  // ── Filter logic ─────────────────────────────────────────────────────────

  function isLineActive(line: Line): boolean {
    if (line.lineStructure === 'SECTION_HEADER') return true;
    if (line.lineStructure === 'SUB_HEADING') return true;
    if (line.lineStructure === 'NOTE_LINE') return false; // hidden in active mode
    return getTotalQty(line) > 0 || Number(line.rate) > 0;
  }

  function visibleLines(sectionId: string): Line[] {
    const sl = lines.filter((l) => l.tradeSectionId === sectionId);
    if (filterMode === 'all') return sl;
    return sl.filter((l) => isLineActive(l));
  }

  // ── Enter key navigation ──────────────────────────────────────────────────

  const handleEnterDown = useCallback((lineId: string, col: string) => {
    const sectionLines = lines.filter((l) => l.lineStructure === 'STANDARD_LINE' || l.lineStructure === 'PROJECT_SUM_LINE');
    const idx = sectionLines.findIndex((l) => l.id === lineId);
    if (idx < sectionLines.length - 1) {
      const nextLine = sectionLines[idx + 1];
      setTimeout(() => document.querySelector<HTMLElement>(`[data-cell-id="${nextLine.id}-${col}"]`)?.click(), 50);
    }
  }, [lines]);

  // ── Context menu actions ──────────────────────────────────────────────────

  async function handleCtxAction(action: InsertAction, lineId: string) {
    const idx = lines.findIndex((l) => l.id === lineId);
    if (idx === -1) return;
    const line = lines[idx];

    if (action === 'delete') {
      if (!confirm('Delete this line?')) return;
      setBusy(true);
      await fetch(`/api/leads/${estimate.id}/cost-plan/lines/${lineId}`, { method: 'DELETE' });
      setLines((p) => p.filter((l) => l.id !== lineId));
      setBusy(false);
      return;
    }

    if (action === 'duplicate') {
      setBusy(true);
      const res = await fetch(`/api/leads/${estimate.id}/cost-plan/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...line, id: undefined, order: line.order + 0.5, lineCode: line.lineCode ? `${line.lineCode}x` : null }),
      });
      if (res.ok) {
        const nl = await res.json();
        setLines((p) => { const n = [...p]; n.splice(idx + 1, 0, normalise(nl)); return n; });
      }
      setBusy(false);
      return;
    }

    if (action === 'move-up' || action === 'move-down') {
      const si = action === 'move-up' ? idx - 1 : idx + 1;
      if (si < 0 || si >= lines.length) return;
      setLines((p) => { const n = [...p]; [n[idx], n[si]] = [n[si], n[idx]]; return n; });
      fetch(`/api/leads/${estimate.id}/cost-plan/lines/${lines[idx].id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: lines[si].order }) });
      fetch(`/api/leads/${estimate.id}/cost-plan/lines/${lines[si].id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: lines[idx].order }) });
      return;
    }

    // Insert variants
    const insertOrder = (action.endsWith('above') || action === 'insert-sub-above') ? line.order - 0.5 : line.order + 0.5;
    const insertIdx = (action.endsWith('above') || action === 'insert-sub-above') ? idx : idx + 1;
    const structureMap: Record<string, LineStructure> = {
      'insert-std-above': 'STANDARD_LINE', 'insert-std-below': 'STANDARD_LINE',
      'insert-sub-above': 'SUB_HEADING',
      'insert-note-below': 'NOTE_LINE',
      'insert-ro-below': 'STANDARD_LINE',
      'insert-opt-below': 'STANDARD_LINE',
    };
    const structure = structureMap[action] ?? 'STANDARD_LINE';
    const extraFlags = action === 'insert-ro-below' ? { isRisk: true } : action === 'insert-opt-below' ? { isOption: true } : {};
    const defaultDesc = structure === 'SUB_HEADING' ? 'Sub-heading' : structure === 'NOTE_LINE' ? 'Note' : 'New line';

    setBusy(true);
    const res = await fetch(`/api/leads/${estimate.id}/cost-plan/lines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tradeSectionId: line.tradeSectionId,
        lineStructure: structure,
        description: defaultDesc,
        type: 'MATERIAL',
        quantity: 0, rate: 0,
        markupPct: structure === 'STANDARD_LINE' ? defaultMarkup : null,
        order: insertOrder,
        ...extraFlags,
      }),
    });
    if (res.ok) {
      const nl = await res.json();
      setLines((p) => { const n = [...p]; n.splice(insertIdx, 0, normalise(nl)); return n; });
    }
    setBusy(false);
  }

  function normalise(l: Record<string, unknown>): Line {
    return {
      ...(l as Line),
      quantity: Number(l.quantity ?? 0),
      rate: Number(l.rate ?? 0),
      total: Number(l.total ?? 0),
      markupPct: l.markupPct != null ? Number(l.markupPct) : null,
      declaredMarginPct: l.declaredMarginPct != null ? Number(l.declaredMarginPct) : null,
      quantities: ((l.quantities ?? []) as LineQty[]).map((q) => ({ ...q, quantity: Number(q.quantity) })),
    } as Line;
  }

  async function handleAddLine(sectionId: string) {
    const sLines = lines.filter((l) => l.tradeSectionId === sectionId);
    const maxOrder = sLines.reduce((m, l) => Math.max(m, l.order), -1);
    setBusy(true);
    const res = await fetch(`/api/leads/${estimate.id}/cost-plan/lines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tradeSectionId: sectionId, lineStructure: 'STANDARD_LINE', description: 'New line', type: 'MATERIAL', quantity: 0, rate: 0, markupPct: defaultMarkup, order: maxOrder + 1 }),
    });
    if (res.ok) {
      const nl = await res.json();
      setLines((p) => [...p, normalise(nl)]);
    }
    setBusy(false);
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  const activeLines = lines.filter((l) =>
    (l.lineStructure === 'STANDARD_LINE' || l.lineStructure === 'PROJECT_SUM_LINE') &&
    !l.isOption && !l.isLockaway && !l.isHidden
  );
  const totalCost = activeLines.reduce((s, l) => s + getTotalQty(l) * Number(l.rate), 0);
  const totalSell = activeLines.reduce((s, l) => s + calcSell(getTotalQty(l) * Number(l.rate), l.markupPct, defaultMarkup), 0);
  const grossRevenue = totalSell * (1 + costRecovery / 100);
  const overallGp = calcGp(totalCost, grossRevenue);
  const gpColour = overallGp >= targetGp ? 'text-green-600' : overallGp >= minGp ? 'text-amber-600' : 'text-red-500';

  // ── Column header helper ──────────────────────────────────────────────────

  const TH = ({ children, align = 'left', w }: { children: React.ReactNode; align?: string; w?: string }) => (
    <th className={`px-2 py-2 text-${align} text-[10px] font-semibold text-zinc-400 uppercase tracking-wide whitespace-nowrap ${w ?? ''}`}>
      {children}
    </th>
  );

  const colSpanBase = 7 + (areas.length > 0 ? areas.length + 1 : 1); // code+desc+unit+qtys+totalQty+rate+cost
  const totalCols = colSpanBase + 4; // + markup+dm+sell+gp + flags + pkg = colSpanBase + 6 total

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ToastContainer />

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-100 bg-white shrink-0">
        {/* View toggle */}
        <div className="flex items-center gap-1 bg-zinc-100 rounded-md p-0.5">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1 text-xs rounded transition-colors ${filterMode === 'all' ? 'bg-white shadow-sm text-zinc-800' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            Show All Lines
          </button>
          <button
            onClick={() => setFilterMode('active')}
            className={`px-3 py-1 text-xs rounded transition-colors ${filterMode === 'active' ? 'bg-white shadow-sm text-zinc-800' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            Show Active Lines Only
          </button>
        </div>
        {busy && <span className="text-xs text-zinc-400 animate-pulse ml-2">Saving…</span>}
        <div className="ml-auto flex items-center gap-5 text-sm">
          <span className="text-zinc-500">Cost <strong className="text-zinc-900 tabular-nums">{fmt(totalCost)}</strong></span>
          <span className="text-zinc-500">Sell <strong className="text-zinc-700 tabular-nums">{fmt(totalSell)}</strong></span>
          <span className={`font-bold tabular-nums ${gpColour}`}>GP {overallGp.toFixed(1)}% <span className="text-zinc-400 font-normal">vs {targetGp.toFixed(1)}% target</span></span>
        </div>
      </div>

      {/* Scrollable table */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse w-full" style={{ minWidth: 900 + areas.length * 72 }}>
          <thead className="sticky top-0 bg-white z-20 border-b border-zinc-200">
            <tr>
              <TH w="w-[72px]">Code</TH>
              <TH>Description</TH>
              <TH w="w-[70px]">Unit</TH>
              {areas.length > 0
                ? areas.map((a) => <TH key={a.id} align="right" w="w-[72px]">{a.name}</TH>)
                : <TH align="right" w="w-[80px]">Qty</TH>
              }
              {areas.length > 0 && <TH align="right" w="w-[72px]">Total Qty</TH>}
              <TH align="right" w="w-[96px]">Unit Rate</TH>
              <TH align="right" w="w-[100px]">Total Cost</TH>
              <TH align="right" w="w-[68px]">Mkup %</TH>
              <TH align="right" w="w-[60px]">DM %</TH>
              <TH align="right" w="w-[100px]">Total Sell</TH>
              <TH align="right" w="w-[64px]">GP %</TH>
              <TH w="w-[88px]">Flags</TH>
              <TH w="w-[120px]">Trade Pkg</TH>
            </tr>
          </thead>

          {estimate.tradeSections.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={totalCols} className="px-4 py-16 text-center text-sm text-zinc-400">
                  No trade sections yet. Create a lead to auto-generate the default cost plan.
                </td>
              </tr>
            </tbody>
          ) : (
            estimate.tradeSections.map((section) => {
              const sl = visibleLines(section.id);
              const sectionCost = lines
                .filter((l) => l.tradeSectionId === section.id && (l.lineStructure === 'STANDARD_LINE' || l.lineStructure === 'PROJECT_SUM_LINE') && !l.isOption && !l.isLockaway && !l.isHidden)
                .reduce((s, l) => s + getTotalQty(l) * Number(l.rate), 0);
              const sectionSell = lines
                .filter((l) => l.tradeSectionId === section.id && (l.lineStructure === 'STANDARD_LINE' || l.lineStructure === 'PROJECT_SUM_LINE') && !l.isOption && !l.isLockaway && !l.isHidden)
                .reduce((s, l) => s + calcSell(getTotalQty(l) * Number(l.rate), l.markupPct, defaultMarkup), 0);
              const sectionGp = calcGp(sectionCost, sectionSell);
              const isCollapsed = collapsed.has(section.id);

              return (
                <tbody key={section.id}>
                  {/* Section header */}
                  <tr
                    className="bg-[#1e3a5f] text-white cursor-pointer select-none"
                    onClick={() => setCollapsed((p) => { const n = new Set(p); n.has(section.id) ? n.delete(section.id) : n.add(section.id); return n; })}
                  >
                    <td className="sticky left-0 bg-[#1e3a5f] z-10 px-2 py-2">
                      <span className="text-blue-300 mr-1 text-xs">{isCollapsed ? '▶' : '▼'}</span>
                      <span className="text-blue-200 font-mono text-[11px]">{section.code}</span>
                    </td>
                    <td colSpan={2 + (areas.length > 0 ? areas.length + 1 : 1)} className="px-2 py-2">
                      <span className="text-sm font-semibold tracking-wide">{section.name}</span>
                    </td>
                    <td colSpan={areas.length > 0 ? 1 : 0}></td>
                    {/* Total cost */}
                    <td className="px-2 py-2 text-right text-sm font-bold tabular-nums">{fmt(sectionCost)}</td>
                    <td colSpan={2}></td>
                    {/* Total sell */}
                    <td className="px-2 py-2 text-right text-sm text-blue-200 tabular-nums">{fmt(sectionSell)}</td>
                    {/* GP */}
                    <td className={`px-2 py-2 text-right text-sm font-bold tabular-nums ${sectionGp >= targetGp ? 'text-green-300' : sectionGp >= minGp ? 'text-yellow-300' : 'text-red-300'}`}>
                      {sectionGp.toFixed(1)}%
                    </td>
                    <td colSpan={2}></td>
                  </tr>

                  {/* Lines */}
                  {!isCollapsed && sl.map((line) => {
                    if (line.lineStructure === 'SECTION_HEADER') {
                      return (
                        <tr key={line.id} className="bg-zinc-700 text-white" onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, lineId: line.id }); }}>
                          <td className="sticky left-0 bg-zinc-700 z-10 px-2 py-1.5 text-zinc-400 font-mono text-xs">{line.lineCode}</td>
                          <td colSpan={totalCols - 1} className="px-2 py-1.5 text-sm font-bold">{line.description}</td>
                        </tr>
                      );
                    }

                    if (line.lineStructure === 'SUB_HEADING') {
                      return (
                        <tr key={line.id} className="bg-zinc-50/80" onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, lineId: line.id }); }}>
                          <td className="sticky left-0 bg-zinc-50/80 z-10 px-2 py-1 text-zinc-300 text-xs"></td>
                          <td colSpan={totalCols - 1} className="px-3 py-1 text-sm font-bold italic text-zinc-500">{line.description}</td>
                        </tr>
                      );
                    }

                    if (line.lineStructure === 'NOTE_LINE') {
                      return (
                        <tr key={line.id} className="bg-white" onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, lineId: line.id }); }}>
                          <td className="sticky left-0 bg-white z-10 px-2 py-0.5 text-zinc-200 text-xs"></td>
                          <td colSpan={totalCols - 1} className="px-5 py-0.5 text-xs italic text-zinc-400">{line.description}</td>
                        </tr>
                      );
                    }

                    return (
                      <StandardRow
                        key={line.id}
                        line={line}
                        estimateId={estimate.id}
                        defaultMarkupPct={defaultMarkup}
                        areas={areas}
                        packages={estimate.tradePackages}
                        onPatch={patchLine}
                        onContextMenu={(e, id) => setCtxMenu({ x: e.clientX, y: e.clientY, lineId: id })}
                        onEnterDown={handleEnterDown}
                      />
                    );
                  })}

                  {/* Add line row */}
                  {!isCollapsed && (
                    <tr>
                      <td colSpan={totalCols} className="px-2 py-1 border-b border-zinc-100">
                        <button onClick={() => handleAddLine(section.id)} disabled={busy} className="text-xs text-brand hover:underline disabled:opacity-40">
                          + Add line
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })
          )}

          {/* Sticky footer */}
          <tfoot className="sticky bottom-0 bg-white z-20 border-t-2 border-zinc-300">
            <tr className="bg-zinc-50/90">
              <td colSpan={4 + (areas.length > 0 ? areas.length + 1 : 1)} className="px-3 py-3 text-sm font-semibold text-zinc-700 text-right">
                Total
              </td>
              <td className="px-2 py-3 text-right text-sm font-bold text-zinc-900 tabular-nums">{fmt(totalCost)}</td>
              <td colSpan={2}></td>
              <td className="px-2 py-3 text-right text-sm font-bold text-zinc-700 tabular-nums">{fmt(totalSell)}</td>
              <td className={`px-2 py-3 text-right text-sm font-bold tabular-nums ${gpColour}`}>{overallGp.toFixed(1)}%</td>
              <td colSpan={2}></td>
            </tr>
            <tr className="bg-white">
              <td colSpan={4 + (areas.length > 0 ? areas.length + 1 : 1)} className="px-3 py-1.5 text-xs text-zinc-400 text-right">
                Gross Revenue (+{costRecovery.toFixed(2)}% recovery)
              </td>
              <td colSpan={4}></td>
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
          onAction={(a) => handleCtxAction(a, ctxMenu.lineId)}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}
