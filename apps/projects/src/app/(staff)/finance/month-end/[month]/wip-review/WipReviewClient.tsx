'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  approveWipReview,
  calculateWip,
  overrideWipLine,
  postWipJournalToXero,
  type WipReviewData,
  type WipLineRow,
} from '@/lib/month-end/actions';

const AUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
function fmtAUD(v: string | number) { return AUD.format(Number(v)); }
function fmtAUDFull(v: string | number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 2 }).format(Number(v));
}

// ─── Override form ────────────────────────────────────────────────────────────

function OverrideForm({
  line,
  onDone,
  onCancel,
}: {
  line: WipLineRow;
  onDone: (overrideWip: number, reason: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(line.overrideWip ?? line.catWip);
  const [reason, setReason] = useState(line.overrideReason ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit() {
    if (!reason.trim()) { setErr('Reason is required.'); return; }
    setSubmitting(true);
    const res = await overrideWipLine({
      wipLineId: line.id,
      overrideWip: Number(val),
      overrideReason: reason.trim(),
    });
    setSubmitting(false);
    if (res.ok) {
      onDone(Number(val), reason.trim());
    } else {
      setErr(res.error ?? 'Failed to apply override.');
    }
  }

  return (
    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
      <div className="flex gap-2 items-end">
        <div>
          <label className="text-xs text-zinc-500 block mb-1">Override WIP ($)</label>
          <input
            type="number"
            step="0.01"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="text-sm border border-zinc-300 rounded px-2 py-1 w-36"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-zinc-500 block mb-1">Reason <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Cost reforecast approved by PM"
            className="text-sm border border-zinc-300 rounded px-2 py-1 w-full"
          />
        </div>
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={submitting} className="text-xs bg-amber-500 hover:bg-amber-600 text-white rounded px-3 py-1 disabled:opacity-50">
          {submitting ? 'Saving…' : 'Apply Override'}
        </button>
        <button onClick={onCancel} className="text-xs text-zinc-500 hover:text-zinc-700">Cancel</button>
      </div>
    </div>
  );
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function WipReviewClient({
  data: initial,
  monthParam,
}: {
  data: WipReviewData;
  monthParam: string;
}) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [overridingLineId, setOverridingLineId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { monthEnd, lines } = data;
  const isLocked = monthEnd.status === 'LOCKED';
  const canApprove = monthEnd.status === 'WIP_CALCULATED';
  const canPost = monthEnd.status === 'WIP_REVIEWED';
  const canRecalculate = monthEnd.status === 'WIP_CALCULATED' || monthEnd.status === 'WIP_REVIEWED';

  function updateLine(id: string, overrideWip: number, overrideReason: string) {
    const prior = Number(lines.find((l) => l.id === id)?.priorMonthWip ?? 0);
    const effectiveWip = overrideWip;
    const effectiveMovement = effectiveWip - prior;
    setData((prev) => {
      const newLines = prev.lines.map((l) =>
        l.id === id
          ? { ...l, overrideWip: String(overrideWip), overrideReason, effectiveWip: String(effectiveWip), effectiveMovement: String(effectiveMovement) }
          : l,
      );
      const netMovement = newLines.reduce((s, l) => s + Number(l.effectiveMovement), 0);
      const thisNetWip = newLines.reduce((s, l) => s + Number(l.effectiveWip), 0);
      return {
        ...prev,
        lines: newLines,
        thisNetWip: thisNetWip.toFixed(2),
        netMovement: netMovement.toFixed(2),
      };
    });
  }

  function handleApprove() {
    setActionError(null);
    startTransition(async () => {
      const res = await approveWipReview(monthEnd.id);
      if (res.ok) {
        setData((prev) => ({ ...prev, monthEnd: { ...prev.monthEnd, status: 'WIP_REVIEWED' } }));
        setSuccessMsg('WIP approved — you can now post the journal to Xero.');
      } else {
        setActionError(res.error ?? 'Failed to approve.');
      }
    });
  }

  function handleRecalculate() {
    setActionError(null);
    startTransition(async () => {
      const res = await calculateWip(monthEnd.id);
      if (res.ok) {
        router.refresh();
      } else {
        setActionError(res.error ?? 'Failed to recalculate.');
      }
    });
  }

  function handlePostToXero() {
    setActionError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const res = await postWipJournalToXero(monthEnd.id);
      if (res.ok) {
        setData((prev) => ({
          ...prev,
          monthEnd: { ...prev.monthEnd, status: 'JOURNAL_POSTED', xeroJournalId: res.journalId ?? null },
        }));
        setSuccessMsg(`Journal posted to Xero — ID: ${res.journalId}`);
        router.refresh();
      } else {
        setActionError(res.error ?? 'Failed to post to Xero.');
      }
    });
  }

  const netMovement = Number(data.netMovement);
  const isPositive = netMovement >= 0;

  // Journal balance check
  const journalSum = lines.reduce((s, l) => s + Number(l.effectiveWip) - Number(l.priorMonthWip), 0);
  const journalBalances = Math.abs(journalSum) < 0.01;

  return (
    <div className="mt-6 space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-1">Prior month net WIP</p>
          <p className="text-lg font-semibold text-zinc-800">{fmtAUD(data.priorNetWip)}</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-1">This month net WIP</p>
          <p className="text-lg font-semibold text-zinc-800">{fmtAUD(data.thisNetWip)}</p>
        </div>
        <div className={`border rounded-xl p-4 ${isPositive ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs text-zinc-500 mb-1">Net WIP movement</p>
          <p className={`text-lg font-semibold ${isPositive ? 'text-green-700' : 'text-red-600'}`}>
            {isPositive ? '+' : ''}{fmtAUD(data.netMovement)}
          </p>
          <p className="text-xs mt-1 text-zinc-400">
            {isPositive ? 'Under-billed — WIP asset increased' : 'Over-billed — WIP liability increased'}
          </p>
        </div>
      </div>

      {/* Journal preview */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-zinc-800 mb-3">Journal entry to be posted to Xero</h2>
        <div className="bg-zinc-50 rounded-lg p-3 font-mono text-xs space-y-1 max-h-48 overflow-y-auto">
          {lines.map((l) => (
            <div key={l.id} className="space-y-0.5">
              <div className="flex justify-between">
                <span className="text-zinc-600">Dr 370 (Closing WIP) — {l.jobNo} {l.projectName}</span>
                <span className="text-zinc-800 font-semibold">{fmtAUDFull(l.effectiveWip)}</span>
              </div>
              <div className="flex justify-between pl-4">
                <span className="text-zinc-500">Cr 330 (Opening WIP) — {l.jobNo} {l.projectName}</span>
                <span className="text-zinc-800">({fmtAUDFull(l.priorMonthWip)})</span>
              </div>
            </div>
          ))}
          <div className="border-t border-zinc-300 mt-2 pt-2 flex justify-between font-semibold">
            <span>Net movement</span>
            <span className={isPositive ? 'text-green-700' : 'text-red-600'}>
              {isPositive ? '+' : ''}{fmtAUDFull(data.netMovement)}
            </span>
          </div>
        </div>
        {!journalBalances && (
          <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            ⚠ Journal does not balance (net {fmtAUDFull(journalSum)}). Confirm WIP account structure with your accountant before posting.
          </div>
        )}
      </div>

      {/* Action messages */}
      {actionError && (
        <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
          {actionError}
        </div>
      )}
      {successMsg && (
        <div className="px-4 py-3 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200">
          {successMsg}
        </div>
      )}

      {/* Action buttons */}
      {!isLocked && (
        <div className="flex gap-3 flex-wrap">
          {canRecalculate && (
            <button
              onClick={handleRecalculate}
              disabled={isPending}
              className="px-4 py-2 text-sm border border-zinc-300 rounded-lg hover:bg-zinc-50 disabled:opacity-50"
            >
              Recalculate
            </button>
          )}
          {canApprove && (
            <button
              onClick={handleApprove}
              disabled={isPending}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
            >
              {isPending ? 'Approving…' : 'Approve & Proceed'}
            </button>
          )}
          {canPost && (
            <button
              onClick={handlePostToXero}
              disabled={isPending}
              className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg disabled:opacity-50"
            >
              {isPending ? 'Posting…' : 'Post to Xero'}
            </button>
          )}
        </div>
      )}

      {/* Per-project table */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-800 mb-3">Per-project WIP breakdown</h2>
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-3 py-2 text-zinc-500 font-semibold uppercase tracking-wide">Job</th>
                <th className="text-left px-3 py-2 text-zinc-500 font-semibold uppercase tracking-wide">Project</th>
                <th className="text-right px-3 py-2 text-zinc-500 font-semibold uppercase tracking-wide">Claim Total</th>
                <th className="text-right px-3 py-2 text-zinc-500 font-semibold uppercase tracking-wide">Total Cost</th>
                <th className="text-right px-3 py-2 text-zinc-500 font-semibold uppercase tracking-wide">CAT WIP</th>
                <th className="text-right px-3 py-2 text-zinc-500 font-semibold uppercase tracking-wide">Prior WIP</th>
                <th className="text-right px-3 py-2 text-zinc-500 font-semibold uppercase tracking-wide">Movement</th>
                <th className="text-right px-3 py-2 text-zinc-500 font-semibold uppercase tracking-wide">Effective</th>
                {!isLocked && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {lines.map((line) => (
                <ProjectRow
                  key={line.id}
                  line={line}
                  isLocked={isLocked}
                  overriding={overridingLineId === line.id}
                  onOverride={() => setOverridingLineId(line.id)}
                  onOverrideDone={(wip, reason) => {
                    updateLine(line.id, wip, reason);
                    setOverridingLineId(null);
                  }}
                  onOverrideCancel={() => setOverridingLineId(null)}
                />
              ))}
            </tbody>
            <tfoot className="border-t-2 border-zinc-300 bg-zinc-50">
              <tr className="font-semibold text-xs">
                <td colSpan={4} className="px-3 py-2 text-zinc-700">Total</td>
                <td className="px-3 py-2 text-right">{fmtAUD(lines.reduce((s, l) => s + Number(l.catWip), 0))}</td>
                <td className="px-3 py-2 text-right">{fmtAUD(lines.reduce((s, l) => s + Number(l.priorMonthWip), 0))}</td>
                <td className="px-3 py-2 text-right">{fmtAUD(lines.reduce((s, l) => s + Number(l.wipMovement), 0))}</td>
                <td className={`px-3 py-2 text-right ${isPositive ? 'text-green-700' : 'text-red-600'}`}>
                  {fmtAUD(lines.reduce((s, l) => s + Number(l.effectiveMovement), 0))}
                </td>
                {!isLocked && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Row component ────────────────────────────────────────────────────────────

function ProjectRow({
  line,
  isLocked,
  overriding,
  onOverride,
  onOverrideDone,
  onOverrideCancel,
}: {
  line: WipLineRow;
  isLocked: boolean;
  overriding: boolean;
  onOverride: () => void;
  onOverrideDone: (wip: number, reason: string) => void;
  onOverrideCancel: () => void;
}) {
  const effectiveMovement = Number(line.effectiveMovement);
  const hasOverride = line.overrideWip != null;

  return (
    <>
      <tr className="hover:bg-zinc-50">
        <td className="px-3 py-2 font-mono text-zinc-500">{line.jobNo}</td>
        <td className="px-3 py-2 text-zinc-800 max-w-[200px] truncate">{line.projectName}</td>
        <td className="px-3 py-2 text-right text-zinc-600">{fmtAUD(line.catClaimTotal)}</td>
        <td className="px-3 py-2 text-right text-zinc-600">{fmtAUD(line.catTotalCost)}</td>
        <td className="px-3 py-2 text-right text-zinc-700">{fmtAUD(line.catWip)}</td>
        <td className="px-3 py-2 text-right text-zinc-500">{fmtAUD(line.priorMonthWip)}</td>
        <td className="px-3 py-2 text-right text-zinc-600">{fmtAUD(line.wipMovement)}</td>
        <td className={`px-3 py-2 text-right font-medium ${effectiveMovement >= 0 ? 'text-green-700' : 'text-red-600'}`}>
          {hasOverride && (
            <span className="mr-1 text-amber-500" title={`Override: ${line.overrideReason}`}>✎</span>
          )}
          {fmtAUD(line.effectiveMovement)}
        </td>
        {!isLocked && (
          <td className="px-3 py-2 text-right">
            <button
              onClick={onOverride}
              className="text-zinc-400 hover:text-zinc-700 text-xs hover:underline"
            >
              {hasOverride ? 'Edit' : 'Override'}
            </button>
          </td>
        )}
      </tr>
      {overriding && (
        <tr>
          <td colSpan={9} className="px-3 pb-2">
            <OverrideForm line={line} onDone={onOverrideDone} onCancel={onOverrideCancel} />
          </td>
        </tr>
      )}
    </>
  );
}
