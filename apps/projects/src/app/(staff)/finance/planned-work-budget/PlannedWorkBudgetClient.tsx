'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type {
  PlannedWorkBudgetData,
  BacklogLineRow,
  PlannedWorkLineRow,
  CrmOpportunityRow,
} from '@/lib/planned-work-budget/actions';
import {
  proposeBacklogLines,
  addBacklogLine,
  updateBacklogLine,
  deleteBacklogLine,
  addPlaceholderLine,
  addPlannedWorkLineFromCrm,
  updatePlannedWorkLine,
  deletePlannedWorkLine,
  linkPlaceholderToCrm,
  distributeSpread,
  updateSpreadCell,
  lockBudget,
  superOverride,
  listOpenCrmOpportunities,
} from '@/lib/planned-work-budget/actions';
import type { RevenueCurveRow } from '@/lib/revenue-curves/actions';

// ─── Formatting ───────────────────────────────────────────────────────────────

const AUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
const fmt = (v: number) => AUD.format(v || 0);

// ─── Editable cells ─────────────────────────────────────────────────────────────

function MoneyInput({ value, disabled, onSave }: { value: number; disabled: boolean; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(value ?? 0));
  useEffect(() => { setV(String(value ?? 0)); }, [value]);
  return (
    <input
      type="number"
      value={v}
      disabled={disabled}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { const num = parseFloat(v) || 0; if (num !== value) onSave(num); }}
      className="w-full bg-transparent text-right text-xs font-mono px-1 py-0.5 rounded disabled:text-zinc-500 focus:bg-white focus:ring-1 focus:ring-blue-300 outline-none"
    />
  );
}

function TextInput({ value, disabled, onSave, placeholder }: { value: string; disabled: boolean; onSave: (v: string) => void; placeholder?: string }) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => { setV(value ?? ''); }, [value]);
  return (
    <input
      type="text"
      value={v}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v !== value) onSave(v); }}
      className="w-full bg-transparent text-xs px-1 py-0.5 rounded disabled:text-zinc-600 focus:bg-white focus:ring-1 focus:ring-blue-300 outline-none"
    />
  );
}

// ─── Section 1 — Backlog carry-in ────────────────────────────────────────────────

function BacklogSection({
  data, editable, onAction,
}: {
  data: PlannedWorkBudgetData;
  editable: boolean;
  onAction: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const rows = data.backlogLines;
  const totals = rows.reduce(
    (t, r) => ({ rev: t.rev + r.carriedRevenue, profit: t.profit + r.carriedProfit, wip: t.wip + r.wipCarryIn }),
    { rev: 0, profit: 0, wip: 0 },
  );

  return (
    <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-800">Section 1 — Backlog {data.currentLabel} (carried in)</h2>
        {editable && (
          <div className="flex items-center gap-2">
            <button onClick={() => onAction(() => proposeBacklogLines(data.financialYear))}
              className="px-2.5 py-1 text-xs border border-blue-300 text-blue-700 rounded-md hover:bg-blue-50">
              Propose from CAT
            </button>
            <button onClick={() => onAction(() => addBacklogLine(data.financialYear, 'New backlog row'))}
              className="px-2.5 py-1 text-xs border border-zinc-300 rounded-md hover:bg-zinc-50">
              + Add row
            </button>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-[11px] text-zinc-500">
              <th className="px-3 py-2 text-left">Project</th>
              <th className="px-2 py-2 text-right w-36">Carried Revenue</th>
              <th className="px-2 py-2 text-right w-36">Carried Profit</th>
              <th className="px-2 py-2 text-right w-36">WIP Carry-In</th>
              <th className="px-2 py-2 text-left w-48">Notes</th>
              <th className="px-2 py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-zinc-400">No carry-in rows. {editable ? 'Use “Propose from CAT” or add a row.' : ''}</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                <td className="px-3 py-1 text-xs text-zinc-800">
                  <div className="flex items-center gap-1.5">
                    <TextInput value={r.projectName} disabled={!editable} onSave={(v) => onAction(() => updateBacklogLine({ lineId: r.id, projectName: v }))} />
                    {!r.isManualAdjustment && r.sourceCatJobNo && (
                      <span className="text-[9px] text-blue-600 bg-blue-50 px-1 rounded shrink-0" title={`Proposed from CAT job ${r.sourceCatJobNo}`}>CAT</span>
                    )}
                    {r.isManualAdjustment && (
                      <span className="text-[9px] text-amber-600 bg-amber-50 px-1 rounded shrink-0">manual</span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-1"><MoneyInput value={r.carriedRevenue} disabled={!editable} onSave={(v) => onAction(() => updateBacklogLine({ lineId: r.id, carriedRevenue: v }))} /></td>
                <td className="px-2 py-1"><MoneyInput value={r.carriedProfit} disabled={!editable} onSave={(v) => onAction(() => updateBacklogLine({ lineId: r.id, carriedProfit: v }))} /></td>
                <td className="px-2 py-1 bg-amber-50/40"><MoneyInput value={r.wipCarryIn} disabled={!editable} onSave={(v) => onAction(() => updateBacklogLine({ lineId: r.id, wipCarryIn: v }))} /></td>
                <td className="px-2 py-1"><TextInput value={r.notes ?? ''} disabled={!editable} placeholder="Scrutiny notes…" onSave={(v) => onAction(() => updateBacklogLine({ lineId: r.id, notes: v }))} /></td>
                <td className="px-2 py-1 text-center">
                  {editable && (
                    <button onClick={() => onAction(() => deleteBacklogLine(r.id))} className="text-zinc-300 hover:text-red-500 text-xs" title="Delete row">✕</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-zinc-50 border-t-2 border-zinc-300">
            <tr>
              <td className="px-3 py-1.5 text-xs font-bold text-zinc-700">Totals</td>
              <td className="px-2 py-1.5 text-right text-xs font-mono font-bold">{fmt(totals.rev)}</td>
              <td className="px-2 py-1.5 text-right text-xs font-mono font-bold">{fmt(totals.profit)}</td>
              <td className="px-2 py-1.5 text-right text-xs font-mono font-bold text-amber-700">{fmt(totals.wip)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

// ─── Section 2 — Planned work (carry-out) ─────────────────────────────────────────

function PlannedWorkSection({
  data, editable, curves, onAction,
}: {
  data: PlannedWorkBudgetData;
  editable: boolean;
  curves: RevenueCurveRow[];
  onAction: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const months = data.months;
  const rows = data.plannedWorkLines;
  const [linkingRow, setLinkingRow] = useState<string | null>(null);
  const [showPlaceholder, setShowPlaceholder] = useState(false);
  const [showCrmPicker, setShowCrmPicker] = useState(false);

  const totals = rows.reduce(
    (t, r) => ({
      contract: t.contract + r.contractValue,
      nextRev: t.nextRev + r.backlogNextRevenue,
      nextProfit: t.nextProfit + r.backlogNextProfit,
    }),
    { contract: 0, nextRev: 0, nextProfit: 0 },
  );
  const monthTotals = months.map((m) => rows.reduce((s, r) => s + (r.spread[m.month]?.amount ?? 0), 0));

  return (
    <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-zinc-800">Section 2 — Unsecured Planned Work (carried out to Backlog {data.nextLabel})</h2>
        {editable && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCrmPicker(true)} className="px-2.5 py-1 text-xs border border-blue-300 text-blue-700 rounded-md hover:bg-blue-50">+ Add from CRM</button>
            <button onClick={() => setShowPlaceholder(true)} className="px-2.5 py-1 text-xs border border-zinc-300 rounded-md hover:bg-zinc-50">+ Add Placeholder</button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="text-sm border-collapse" style={{ minWidth: `${560 + months.length * 84}px` }}>
          <thead>
            <tr className="border-b border-zinc-200 text-[11px] text-zinc-500">
              <th className="px-3 py-2 text-left sticky left-0 bg-white z-10 w-52">Opportunity</th>
              <th className="px-2 py-2 text-right w-32">Contract</th>
              <th className="px-2 py-2 text-right w-20">Margin %</th>
              {months.map((m) => (
                <th key={m.month} className="px-1 py-2 text-right whitespace-nowrap w-20">{m.label}</th>
              ))}
              <th className="px-2 py-2 text-left w-44">Distribute</th>
              <th className="px-2 py-2 text-right w-32 border-l border-zinc-200">Backlog {data.nextLabel} Rev</th>
              <th className="px-2 py-2 text-right w-32">Backlog {data.nextLabel} Profit</th>
              <th className="px-2 py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={months.length + 7} className="px-3 py-6 text-center text-xs text-zinc-400">No planned work rows. {editable ? 'Add from CRM or a placeholder.' : ''}</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                <td className="px-3 py-1 text-xs text-zinc-800 sticky left-0 bg-white">
                  <div className="flex items-center gap-1.5">
                    <TextInput value={r.opportunityName} disabled={!editable} onSave={(v) => onAction(() => updatePlannedWorkLine({ lineId: r.id, opportunityName: v }))} />
                    {r.source === 'CRM'
                      ? <span className="text-[9px] text-emerald-700 bg-emerald-50 px-1 rounded shrink-0" title={r.crmOpportunityId ? `HubSpot ${r.crmOpportunityId}` : 'CRM-linked'}>CRM</span>
                      : <span className="text-[9px] text-amber-700 bg-amber-50 px-1 rounded shrink-0">unlinked</span>}
                  </div>
                  {editable && r.source === 'PLACEHOLDER' && (
                    <button onClick={() => setLinkingRow(r.id)} className="text-[10px] text-blue-600 hover:underline mt-0.5">Link to CRM</button>
                  )}
                </td>
                <td className="px-2 py-1"><MoneyInput value={r.contractValue} disabled={!editable} onSave={(v) => onAction(() => updatePlannedWorkLine({ lineId: r.id, contractValue: v }))} /></td>
                <td className="px-2 py-1"><MoneyInput value={r.forecastMarginPct} disabled={!editable} onSave={(v) => onAction(() => updatePlannedWorkLine({ lineId: r.id, forecastMarginPct: v }))} /></td>
                {months.map((m) => {
                  const cell = r.spread[m.month];
                  return (
                    <td key={m.month} className={`px-0.5 py-1 ${cell?.locked ? 'bg-blue-50' : ''}`}>
                      <div className="flex items-center">
                        <MoneyInput value={cell?.amount ?? 0} disabled={!editable} onSave={(v) => onAction(() => updateSpreadCell({ lineId: r.id, month: m.month, amount: v, locked: cell?.locked ?? false }))} />
                        {editable && (
                          <button title={cell?.locked ? 'Unlock cell' : 'Lock cell'} onClick={() => onAction(() => updateSpreadCell({ lineId: r.id, month: m.month, amount: cell?.amount ?? 0, locked: !(cell?.locked ?? false) }))}
                            className={`text-[9px] px-0.5 ${cell?.locked ? 'text-blue-600' : 'text-zinc-300 hover:text-zinc-500'}`}>
                            {cell?.locked ? '🔒' : '🔓'}
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
                <td className="px-2 py-1">
                  {editable ? (
                    <select
                      value={r.revenueCurveId ?? ''}
                      onChange={(e) => { if (e.target.value) onAction(() => distributeSpread(r.id, e.target.value)); }}
                      className="w-full text-[11px] border border-zinc-200 rounded px-1 py-0.5 bg-white"
                    >
                      <option value="">Pick curve…</option>
                      {curves.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : (
                    <span className="text-[11px] text-zinc-400">{curves.find((c) => c.id === r.revenueCurveId)?.name ?? '—'}</span>
                  )}
                </td>
                <td className="px-2 py-1 text-right text-xs font-mono border-l border-zinc-200">{fmt(r.backlogNextRevenue)}</td>
                <td className="px-2 py-1 text-right text-xs font-mono">{fmt(r.backlogNextProfit)}</td>
                <td className="px-2 py-1 text-center">
                  {editable && <button onClick={() => onAction(() => deletePlannedWorkLine(r.id))} className="text-zinc-300 hover:text-red-500 text-xs" title="Delete row">✕</button>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-zinc-50 border-t-2 border-zinc-300">
            <tr>
              <td className="px-3 py-1.5 text-xs font-bold text-zinc-700 sticky left-0 bg-zinc-50">Totals</td>
              <td className="px-2 py-1.5 text-right text-xs font-mono font-bold">{fmt(totals.contract)}</td>
              <td />
              {monthTotals.map((mt, i) => <td key={i} className="px-1 py-1.5 text-right text-[11px] font-mono font-semibold text-zinc-600">{fmt(mt)}</td>)}
              <td />
              <td className="px-2 py-1.5 text-right text-xs font-mono font-bold border-l border-zinc-200">{fmt(totals.nextRev)}</td>
              <td className="px-2 py-1.5 text-right text-xs font-mono font-bold">{fmt(totals.nextProfit)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {showPlaceholder && <PlaceholderDialog onClose={() => setShowPlaceholder(false)} onAdd={(p) => { setShowPlaceholder(false); onAction(() => addPlaceholderLine(data.financialYear, p)); }} />}
      {showCrmPicker && <CrmPickerDialog onClose={() => setShowCrmPicker(false)} onPick={(leadId) => { setShowCrmPicker(false); onAction(() => addPlannedWorkLineFromCrm(data.financialYear, leadId)); }} />}
      {linkingRow && <CrmPickerDialog title="Link placeholder to CRM" onClose={() => setLinkingRow(null)} onPick={(leadId) => { const id = linkingRow; setLinkingRow(null); onAction(() => linkPlaceholderToCrm(id, leadId)); }} />}
    </section>
  );
}

// ─── CRM picker ──────────────────────────────────────────────────────────────────

function CrmPickerDialog({ title = 'Add from CRM', onClose, onPick }: { title?: string; onClose: () => void; onPick: (leadId: string) => void }) {
  const [rows, setRows] = useState<CrmOpportunityRow[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    listOpenCrmOpportunities().then((r) => { if (r.ok) setRows(r.rows ?? []); else setErr(r.error ?? 'Failed to load.'); });
  }, []);
  return (
    <Modal title={title} onClose={onClose} wide>
      {err && <p className="text-xs text-red-600 mb-2">{err}</p>}
      {!rows && <p className="text-xs text-zinc-400">Loading open opportunities…</p>}
      {rows && rows.length === 0 && <p className="text-xs text-zinc-400">No open CRM opportunities found.</p>}
      {rows && rows.length > 0 && (
        <div className="max-h-80 overflow-y-auto border border-zinc-100 rounded-lg divide-y divide-zinc-100">
          {rows.map((o) => (
            <button key={o.leadId} onClick={() => onPick(o.leadId)} className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-zinc-50">
              <span className="text-sm text-zinc-800">{o.name}</span>
              <span className="text-xs text-zinc-500 font-mono">{fmt(o.contractValue)} · {o.marginPct.toFixed(1)}%</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

function PlaceholderDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (p: { opportunityName: string; contractValue: number; forecastMarginPct: number }) => void }) {
  const [name, setName] = useState('');
  const [contract, setContract] = useState('');
  const [margin, setMargin] = useState('');
  return (
    <Modal title="Add Placeholder opportunity" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-zinc-500">Opportunity name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-zinc-300 rounded-lg px-3 py-1.5 text-sm" placeholder="e.g. Level 4 fitout — placeholder" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-500">Contract value</label>
            <input type="number" value={contract} onChange={(e) => setContract(e.target.value)} className="w-full border border-zinc-300 rounded-lg px-3 py-1.5 text-sm" placeholder="0" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Forecast margin %</label>
            <input type="number" value={margin} onChange={(e) => setMargin(e.target.value)} className="w-full border border-zinc-300 rounded-lg px-3 py-1.5 text-sm" placeholder="e.g. 18" />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 border border-zinc-300 rounded-lg hover:bg-zinc-50">Cancel</button>
        <button onClick={() => onAdd({ opportunityName: name, contractValue: parseFloat(contract) || 0, forecastMarginPct: parseFloat(margin) || 0 })}
          disabled={!name.trim()} className="px-4 py-2 text-sm bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50">Add row</button>
      </div>
    </Modal>
  );
}

// ─── Lock / Override dialogs ───────────────────────────────────────────────────

function LockDialog({ onClose, onLock }: { onClose: () => void; onLock: (accountant: string, wip: boolean) => void }) {
  const [accountant, setAccountant] = useState('');
  const [wip, setWip] = useState(false);
  const canLock = accountant.trim().length >= 2 && wip;
  return (
    <Modal title="Lock Budget" onClose={onClose}>
      <p className="text-sm text-zinc-600 mb-4">Locking freezes the budget for the year. Requires Accountant co-sign and an explicit WIP sign-off.</p>
      <label className="text-xs text-zinc-500">Accountant co-signer (name)</label>
      <input value={accountant} onChange={(e) => setAccountant(e.target.value)} className="w-full border border-zinc-300 rounded-lg px-3 py-1.5 text-sm mb-3" placeholder="Accountant present and co-signing" />
      <label className="flex items-start gap-2 text-sm text-zinc-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <input type="checkbox" checked={wip} onChange={(e) => setWip(e.target.checked)} className="mt-0.5" />
        <span>I confirm the <strong>WIP carry-in figures have been scrutinised and signed off</strong> for this budget year.</span>
      </label>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 border border-zinc-300 rounded-lg hover:bg-zinc-50">Cancel</button>
        <button onClick={() => onLock(accountant, wip)} disabled={!canLock} className="px-4 py-2 text-sm bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50">Lock Budget</button>
      </div>
    </Modal>
  );
}

function OverrideDialog({ onClose, onOverride }: { onClose: () => void; onOverride: (accountant: string, reason: string) => void }) {
  const [accountant, setAccountant] = useState('');
  const [reason, setReason] = useState('');
  const canOverride = accountant.trim().length >= 2 && reason.trim().length >= 20;
  return (
    <Modal title="Super Override" onClose={onClose}>
      <p className="text-sm text-zinc-600 mb-4">This re-opens a <strong>locked</strong> budget for editing. It is fully audit-logged. Requires Accountant co-sign and a written reason (min 20 characters).</p>
      <label className="text-xs text-zinc-500">Accountant co-signer (name)</label>
      <input value={accountant} onChange={(e) => setAccountant(e.target.value)} className="w-full border border-zinc-300 rounded-lg px-3 py-1.5 text-sm mb-3" placeholder="Accountant present and co-signing" />
      <label className="text-xs text-zinc-500">Reason for override</label>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full border border-zinc-300 rounded-lg px-3 py-1.5 text-sm resize-none" placeholder="Why is the locked budget being re-opened?" />
      <p className="text-[10px] text-zinc-400 text-right">{reason.length}/20</p>
      <div className="flex justify-end gap-2 mt-3">
        <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 border border-zinc-300 rounded-lg hover:bg-zinc-50">Cancel</button>
        <button onClick={() => onOverride(accountant, reason)} disabled={!canOverride} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">Override & Re-open</button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className={`relative bg-white rounded-xl shadow-2xl border border-zinc-200 p-6 w-full mx-4 ${wide ? 'max-w-lg' : 'max-w-md'}`}>
        <h3 className="text-base font-semibold text-zinc-900 mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────────

export function PlannedWorkBudgetClient({ initialData, curves }: { initialData: PlannedWorkBudgetData; curves: RevenueCurveRow[] }) {
  const router = useRouter();
  const data = initialData;
  const editable = data.editable;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [showLock, setShowLock] = useState(false);
  const [showOverride, setShowOverride] = useState(false);

  function runAction(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError('');
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) { setError(res.error ?? 'Action failed.'); setTimeout(() => setError(''), 5000); }
      router.refresh();
    });
  }

  function changeFy(fy: number) {
    startTransition(() => router.push(`/finance/planned-work-budget?fy=${fy}`));
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="sticky top-0 z-30 bg-white border-b border-zinc-200 shadow-sm">
        <div className="flex items-center justify-between gap-4 px-6 py-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-zinc-900">Planned Work Budget — {data.currentLabel}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${data.status === 'LOCKED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {data.status === 'LOCKED' ? 'LOCKED' : 'DRAFT'}
            </span>
            {isPending && <span className="text-xs text-zinc-400">saving…</span>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={data.financialYear} onChange={(e) => changeFy(Number(e.target.value))} className="border border-zinc-300 rounded-lg px-2 py-1 text-sm bg-white">
              {data.availableYears.map((y) => <option key={y} value={y}>FY{String(y).slice(-2)} (Jul {y - 1}–Jun {y})</option>)}
            </select>
            {data.status === 'DRAFT' && (
              <button onClick={() => setShowLock(true)} className="px-3 py-1.5 text-sm bg-zinc-900 text-white rounded-lg hover:bg-zinc-700">Lock Budget</button>
            )}
            {data.status === 'LOCKED' && (
              <button onClick={() => setShowOverride(true)} className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50">Super Override</button>
            )}
          </div>
        </div>
        {data.status === 'LOCKED' && (
          <div className="px-6 pb-2 text-xs text-zinc-500">
            Locked {data.lockedAt ? new Date(data.lockedAt).toLocaleDateString('en-AU') : ''}
            {data.lockedAccountant ? ` · Accountant co-sign: ${data.lockedAccountant}` : ''}
            {data.wipSignedOff ? ' · WIP signed off ✓' : ''}
          </div>
        )}
      </div>

      {error && (
        <div className="fixed top-4 right-4 z-40 bg-red-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg">{error}</div>
      )}

      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        <BacklogSection data={data} editable={editable} onAction={runAction} />
        <PlannedWorkSection data={data} editable={editable} curves={curves} onAction={runAction} />
      </div>

      {showLock && <LockDialog onClose={() => setShowLock(false)} onLock={(acc, wip) => { setShowLock(false); runAction(() => lockBudget({ financialYear: data.financialYear, accountantName: acc, wipSignedOff: wip })); }} />}
      {showOverride && <OverrideDialog onClose={() => setShowOverride(false)} onOverride={(acc, reason) => { setShowOverride(false); runAction(() => superOverride({ financialYear: data.financialYear, accountantName: acc, reason })); }} />}
    </div>
  );
}
