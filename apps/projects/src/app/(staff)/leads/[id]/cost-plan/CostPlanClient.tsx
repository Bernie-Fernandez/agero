'use client';
import { useState, useTransition, useOptimistic } from 'react';
import { showToast, ToastContainer } from '@/components/Toast';
import { createLine, updateLine, deleteLine, addTradeSectionToEstimate, createArea } from '../actions';

// ─── Types ────────────────────────────────────────────────────────────────────

type TradeSection = { id: string; name: string; code: string | null; order: number };
type Area = { id: string; name: string };
type Scenario = { id: string; name: string; isBase: boolean };
type Line = {
  id: string;
  description: string;
  type: string;
  quantity: number | string;
  unit: string | null;
  rate: number | string;
  total: number | string;
  isRisk: boolean;
  isOption: boolean;
  isPcSum: boolean;
  isLockaway: boolean;
  isHidden: boolean;
  notes: string | null;
  tradeSectionId: string | null;
  areaId: string | null;
  tradeSection: { id: string; name: string; code: string | null } | null;
  area: { id: string; name: string } | null;
};

type Estimate = {
  id: string;
  defaultMarkupPct: number | string;
  costRecoveryPct: number | string;
  targetGpPct: number | string;
  tradeSections: TradeSection[];
  areas: Area[];
  scenarios: Scenario[];
  lines: Line[];
};

const LINE_TYPES = ['LABOUR', 'MATERIAL', 'SUBCONTRACTOR', 'ALLOWANCE', 'PROVISIONAL_SUM'];
const TYPE_LABELS: Record<string, string> = {
  LABOUR: 'Labour', MATERIAL: 'Material', SUBCONTRACTOR: 'Sub', ALLOWANCE: 'Allow.', PROVISIONAL_SUM: 'PC Sum',
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);
}

// ─── Flag badges ─────────────────────────────────────────────────────────────

function FlagBadge({ label, color }: { label: string; color: string }) {
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${color}`}>{label}</span>;
}

// ─── Inline edit row ─────────────────────────────────────────────────────────

function LineRow({
  line,
  estimateId,
  sections,
  areas,
  onMutate,
}: {
  line: Line;
  estimateId: string;
  sections: TradeSection[];
  areas: Area[];
  onMutate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    description: line.description,
    type: line.type,
    quantity: String(Number(line.quantity)),
    unit: line.unit ?? '',
    rate: String(Number(line.rate)),
    tradeSectionId: line.tradeSectionId ?? '',
    areaId: line.areaId ?? '',
    isRisk: line.isRisk,
    isOption: line.isOption,
    isPcSum: line.isPcSum,
    isLockaway: line.isLockaway,
    isHidden: line.isHidden,
    notes: line.notes ?? '',
  });

  const calcTotal = Number(form.quantity) * Number(form.rate);

  function handleSave() {
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.set(k, String(v)));
    startTransition(async () => {
      await updateLine(line.id, estimateId, fd);
      setEditing(false);
      onMutate();
    });
  }

  function handleDelete() {
    if (!confirm('Delete this line?')) return;
    startTransition(async () => {
      await deleteLine(line.id, estimateId);
      onMutate();
    });
  }

  if (editing) {
    return (
      <tr className="bg-zinc-50 border-b border-zinc-200">
        <td className="px-3 py-2" colSpan={2}>
          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full border border-zinc-200 rounded px-2 py-1 text-sm"
            placeholder="Description"
          />
        </td>
        <td className="px-2 py-2">
          <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="border border-zinc-200 rounded px-2 py-1 text-xs w-full">
            {LINE_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </td>
        <td className="px-2 py-2">
          <input type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} className="border border-zinc-200 rounded px-2 py-1 text-sm w-20" />
        </td>
        <td className="px-2 py-2">
          <input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} className="border border-zinc-200 rounded px-2 py-1 text-sm w-16" placeholder="unit" />
        </td>
        <td className="px-2 py-2">
          <input type="number" value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} className="border border-zinc-200 rounded px-2 py-1 text-sm w-24" />
        </td>
        <td className="px-2 py-2 text-sm text-zinc-700 font-medium">{fmt(calcTotal)}</td>
        <td className="px-2 py-2">
          <div className="flex flex-wrap gap-1">
            {(['isRisk', 'isOption', 'isPcSum', 'isLockaway', 'isHidden'] as const).map((flag) => (
              <label key={flag} className="flex items-center gap-0.5 text-[10px] cursor-pointer">
                <input type="checkbox" checked={form[flag]} onChange={(e) => setForm((f) => ({ ...f, [flag]: e.target.checked }))} />
                {flag === 'isRisk' ? 'R&O' : flag === 'isOption' ? 'Opt' : flag === 'isPcSum' ? 'PC' : flag === 'isLockaway' ? 'Lock' : 'Hid'}
              </label>
            ))}
          </div>
        </td>
        <td className="px-2 py-2">
          <div className="flex gap-1">
            <button onClick={handleSave} disabled={pending} className="px-2 py-1 text-xs bg-brand text-white rounded hover:bg-brand/90 disabled:opacity-50">Save</button>
            <button onClick={() => setEditing(false)} className="px-2 py-1 text-xs border border-zinc-200 rounded hover:bg-zinc-50">Cancel</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-zinc-100 hover:bg-zinc-50 group">
      <td className="px-3 py-2 text-xs text-zinc-400">{line.tradeSection?.code ?? ''}</td>
      <td className="px-3 py-2 text-sm text-zinc-800">
        <span>{line.description}</span>
        <div className="flex gap-1 mt-0.5">
          {line.isRisk && <FlagBadge label="R&O" color="bg-amber-100 text-amber-700" />}
          {line.isOption && <FlagBadge label="OPT" color="bg-purple-100 text-purple-700" />}
          {line.isPcSum && <FlagBadge label="PC" color="bg-blue-100 text-blue-700" />}
          {line.isLockaway && <FlagBadge label="LOCK" color="bg-orange-100 text-orange-700" />}
          {line.isHidden && <FlagBadge label="HID" color="bg-zinc-100 text-zinc-500" />}
        </div>
      </td>
      <td className="px-2 py-2 text-xs text-zinc-500">{TYPE_LABELS[line.type] ?? line.type}</td>
      <td className="px-2 py-2 text-sm text-right text-zinc-700">{Number(line.quantity).toFixed(2)}</td>
      <td className="px-2 py-2 text-xs text-zinc-500">{line.unit ?? ''}</td>
      <td className="px-2 py-2 text-sm text-right text-zinc-700">{fmt(Number(line.rate))}</td>
      <td className="px-2 py-2 text-sm text-right font-medium text-zinc-900">{fmt(Number(line.total))}</td>
      <td className="px-2 py-2 text-xs text-zinc-400">{line.area?.name ?? ''}</td>
      <td className="px-2 py-2">
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)} className="p-1 text-zinc-400 hover:text-zinc-700 rounded">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </button>
          <button onClick={handleDelete} className="p-1 text-zinc-400 hover:text-red-600 rounded">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Add Line Row ──────────────────────────────────────────────────────────────

function AddLineRow({
  estimateId,
  sections,
  areas,
  defaultSectionId,
  onAdded,
}: {
  estimateId: string;
  sections: TradeSection[];
  areas: Area[];
  defaultSectionId?: string;
  onAdded: () => void;
}) {
  const [show, setShow] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    description: '', type: 'MATERIAL', quantity: '1', unit: '', rate: '0',
    tradeSectionId: defaultSectionId ?? '', areaId: '',
    isRisk: false, isOption: false, isPcSum: false, isLockaway: false, isHidden: false,
  });

  function handleAdd() {
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.set(k, String(v)));
    startTransition(async () => {
      await createLine(estimateId, fd);
      setForm((f) => ({ ...f, description: '', quantity: '1', unit: '', rate: '0' }));
      setShow(false);
      onAdded();
    });
  }

  if (!show) {
    return (
      <tr>
        <td colSpan={9} className="px-3 py-1.5">
          <button onClick={() => setShow(true)} className="text-xs text-brand hover:underline">+ Add line</button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-blue-50/30 border-b border-zinc-200">
      <td className="px-2 py-2">
        <select value={form.tradeSectionId} onChange={(e) => setForm((f) => ({ ...f, tradeSectionId: e.target.value }))} className="border border-zinc-200 rounded px-1 py-1 text-xs w-20">
          <option value="">—</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
        </select>
      </td>
      <td className="px-2 py-2">
        <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full border border-zinc-200 rounded px-2 py-1 text-sm" placeholder="Description *" />
      </td>
      <td className="px-2 py-2">
        <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="border border-zinc-200 rounded px-1 py-1 text-xs">
          {LINE_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
      </td>
      <td className="px-2 py-2"><input type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} className="border border-zinc-200 rounded px-2 py-1 text-sm w-20" /></td>
      <td className="px-2 py-2"><input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} className="border border-zinc-200 rounded px-2 py-1 text-sm w-16" placeholder="unit" /></td>
      <td className="px-2 py-2"><input type="number" value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} className="border border-zinc-200 rounded px-2 py-1 text-sm w-24" /></td>
      <td className="px-2 py-2 text-sm text-zinc-700 font-medium">{fmt(Number(form.quantity) * Number(form.rate))}</td>
      <td className="px-2 py-2">
        <select value={form.areaId} onChange={(e) => setForm((f) => ({ ...f, areaId: e.target.value }))} className="border border-zinc-200 rounded px-1 py-1 text-xs w-24">
          <option value="">—</option>
          {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </td>
      <td className="px-2 py-2">
        <div className="flex gap-1">
          <button onClick={handleAdd} disabled={pending || !form.description.trim()} className="px-2 py-1 text-xs bg-brand text-white rounded disabled:opacity-50">Add</button>
          <button onClick={() => setShow(false)} className="px-2 py-1 text-xs border border-zinc-200 rounded">×</button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CostPlanClient({
  estimate,
  orgTradeSections,
}: {
  estimate: Estimate;
  orgTradeSections: TradeSection[];
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAddSection, setShowAddSection] = useState(false);
  const [showAddArea, setShowAddArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [pending, startTransition] = useTransition();

  const mutate = () => setRefreshKey((k) => k + 1);

  function handleAddSection(sectionId: string) {
    startTransition(async () => {
      await addTradeSectionToEstimate(estimate.id, sectionId);
      setShowAddSection(false);
      mutate();
    });
  }

  function handleAddArea() {
    if (!newAreaName.trim()) return;
    startTransition(async () => {
      await createArea(estimate.id, newAreaName.trim());
      setNewAreaName('');
      setShowAddArea(false);
      mutate();
    });
  }

  const totalCost = estimate.lines
    .filter((l) => !l.isOption && !l.isLockaway && !l.isHidden)
    .reduce((s, l) => s + Number(l.total), 0);

  const markup = Number(estimate.defaultMarkupPct) / 100;
  const costRecovery = Number(estimate.costRecoveryPct) / 100;
  const gross = totalCost * (1 + markup) * (1 + costRecovery);
  const gp = gross > 0 ? ((gross - totalCost) / gross) * 100 : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ToastContainer />

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100 bg-white shrink-0">
        <button onClick={() => setShowAddSection((v) => !v)} className="text-sm text-brand hover:underline">+ Add Trade Section</button>
        <button onClick={() => setShowAddArea((v) => !v)} className="text-sm text-brand hover:underline">+ Add Area</button>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="text-zinc-500">Cost: <strong className="text-zinc-900">{fmt(totalCost)}</strong></span>
          <span className="text-zinc-500">Gross: <strong className="text-zinc-900">{fmt(gross)}</strong></span>
          <span className={`font-semibold ${gp >= Number(estimate.targetGpPct) ? 'text-green-600' : gp >= 15 ? 'text-amber-600' : 'text-red-600'}`}>GP: {gp.toFixed(2)}%</span>
        </div>
      </div>

      {/* Add Section dropdown */}
      {showAddSection && (
        <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-200 flex flex-wrap gap-2">
          {orgTradeSections
            .filter((s) => !estimate.tradeSections.some((es) => es.code === s.code))
            .map((s) => (
              <button
                key={s.id}
                onClick={() => handleAddSection(s.id)}
                disabled={pending}
                className="px-3 py-1.5 text-xs border border-zinc-200 rounded-md bg-white hover:bg-zinc-50"
              >
                {s.code} — {s.name}
              </button>
            ))}
          {orgTradeSections.filter((s) => !estimate.tradeSections.some((es) => es.code === s.code)).length === 0 && (
            <span className="text-xs text-zinc-400">All trade sections added. Seed trade sections first.</span>
          )}
        </div>
      )}

      {/* Add Area inline */}
      {showAddArea && (
        <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-200 flex items-center gap-2">
          <input
            value={newAreaName}
            onChange={(e) => setNewAreaName(e.target.value)}
            placeholder="Area name…"
            className="border border-zinc-200 rounded px-3 py-1.5 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleAddArea()}
          />
          <button onClick={handleAddArea} disabled={pending} className="px-3 py-1.5 text-sm bg-brand text-white rounded">Add</button>
          <button onClick={() => setShowAddArea(false)} className="px-3 py-1.5 text-sm border border-zinc-200 rounded">Cancel</button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <thead className="sticky top-0 bg-white z-10 border-b border-zinc-200">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 w-12">Code</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500">Description</th>
              <th className="px-2 py-2.5 text-left text-xs font-semibold text-zinc-500 w-20">Type</th>
              <th className="px-2 py-2.5 text-right text-xs font-semibold text-zinc-500 w-20">Qty</th>
              <th className="px-2 py-2.5 text-left text-xs font-semibold text-zinc-500 w-16">Unit</th>
              <th className="px-2 py-2.5 text-right text-xs font-semibold text-zinc-500 w-28">Rate</th>
              <th className="px-2 py-2.5 text-right text-xs font-semibold text-zinc-500 w-28">Total</th>
              <th className="px-2 py-2.5 text-left text-xs font-semibold text-zinc-500 w-24">Area</th>
              <th className="px-2 py-2.5 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {estimate.tradeSections.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-zinc-400">No trade sections yet. Add a section to start building your cost plan.</td></tr>
            )}
            {estimate.tradeSections.map((section) => {
              const sectionLines = estimate.lines.filter((l) => l.tradeSectionId === section.id);
              const sectionTotal = sectionLines.filter((l) => !l.isOption && !l.isLockaway && !l.isHidden).reduce((s, l) => s + Number(l.total), 0);
              return (
                <>
                  <tr key={`section-${section.id}`} className="bg-zinc-50/80">
                    <td colSpan={6} className="px-3 py-2 text-xs font-semibold text-zinc-700 uppercase tracking-wide">
                      {section.code && <span className="text-zinc-400 mr-1.5">{section.code}</span>}
                      {section.name}
                    </td>
                    <td className="px-2 py-2 text-right text-xs font-bold text-zinc-800">{fmt(sectionTotal)}</td>
                    <td colSpan={2}></td>
                  </tr>
                  {sectionLines.map((line) => (
                    <LineRow
                      key={`line-${line.id}-${refreshKey}`}
                      line={line}
                      estimateId={estimate.id}
                      sections={estimate.tradeSections}
                      areas={estimate.areas}
                      onMutate={mutate}
                    />
                  ))}
                  <AddLineRow
                    key={`add-${section.id}-${refreshKey}`}
                    estimateId={estimate.id}
                    sections={estimate.tradeSections}
                    areas={estimate.areas}
                    defaultSectionId={section.id}
                    onAdded={mutate}
                  />
                </>
              );
            })}

            {/* Unassigned lines */}
            {estimate.lines.filter((l) => !l.tradeSectionId).length > 0 && (
              <>
                <tr className="bg-zinc-50/80">
                  <td colSpan={9} className="px-3 py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Unassigned</td>
                </tr>
                {estimate.lines.filter((l) => !l.tradeSectionId).map((line) => (
                  <LineRow key={`line-${line.id}-${refreshKey}`} line={line} estimateId={estimate.id} sections={estimate.tradeSections} areas={estimate.areas} onMutate={mutate} />
                ))}
              </>
            )}

            {/* Global add line (no section) */}
            {estimate.tradeSections.length === 0 && (
              <AddLineRow key={`add-global-${refreshKey}`} estimateId={estimate.id} sections={estimate.tradeSections} areas={estimate.areas} onAdded={mutate} />
            )}
          </tbody>

          {/* Footer totals */}
          <tfoot className="sticky bottom-0 bg-white border-t-2 border-zinc-200">
            <tr>
              <td colSpan={6} className="px-3 py-3 text-sm font-semibold text-zinc-700 text-right">Total Cost</td>
              <td className="px-2 py-3 text-right text-sm font-bold text-zinc-900">{fmt(totalCost)}</td>
              <td colSpan={2}></td>
            </tr>
            <tr>
              <td colSpan={6} className="px-3 py-2 text-xs text-zinc-500 text-right">Gross Revenue ({Number(estimate.defaultMarkupPct).toFixed(2)}% markup + {Number(estimate.costRecoveryPct).toFixed(2)}% recovery)</td>
              <td className="px-2 py-2 text-right text-xs font-medium text-zinc-700">{fmt(gross)}</td>
              <td colSpan={2}></td>
            </tr>
            <tr>
              <td colSpan={6} className="px-3 py-2 text-xs text-zinc-500 text-right">Gross Profit %</td>
              <td className={`px-2 py-2 text-right text-xs font-bold ${gp >= Number(estimate.targetGpPct) ? 'text-green-600' : gp >= 15 ? 'text-amber-600' : 'text-red-600'}`}>{gp.toFixed(2)}%</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
