'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

type Section = { sectionKey: string; aiDraft?: string | null; editedContent?: string | null; aiGeneratedAt?: string | null };
type Report = {
  id: string;
  reportMonth: string;
  status: 'DRAFT' | 'REVIEW' | 'FINAL';
  generatedAt: string;
  preparedBy: { firstName: string; lastName: string };
  finalisedBy?: { firstName: string; lastName: string } | null;
  finalisedAt?: string | null;
  sections: Section[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Calculations = any;

// ─── Format helpers ───────────────────────────────────────────────────────────

function fmt(n: number) {
  if (isNaN(n)) return '—';
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
}
function fmtPct(n: number) { return isNaN(n) ? '—' : (n * 100).toFixed(1) + '%'; }
function fmtNum(n: number, dp = 2) { return isNaN(n) ? '—' : n.toFixed(dp); }
function fmtMonth(s: string) {
  return new Date(s).toLocaleDateString('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Status colours ───────────────────────────────────────────────────────────

const STATUS_COLOURS: Record<string, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-600',
  REVIEW: 'bg-amber-100 text-amber-700',
  FINAL: 'bg-green-100 text-green-700',
};

const FLAG_COLOURS: Record<string, string> = {
  GREEN: 'bg-green-100 text-green-700',
  AMBER: 'bg-amber-100 text-amber-700',
  RED: 'bg-red-100 text-red-700',
  NONE: 'bg-zinc-100 text-zinc-500',
};

// ─── Commentary panel component ───────────────────────────────────────────────

function CommentaryPanel({
  sectionKey,
  reportId,
  section,
  isFinal,
  onUpdate,
}: {
  sectionKey: string;
  reportId: string;
  section: Section | undefined;
  isFinal: boolean;
  onUpdate: (key: string, updated: Section) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(section?.editedContent ?? section?.aiDraft ?? '');
  const [saving, setSaving] = useState(false);

  const displayContent = section?.editedContent || section?.aiDraft;

  async function handleGenerate() {
    setGenerating(true);
    const res = await fetch('/api/finance/generate-commentary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionKey, reportId }),
    });
    if (res.ok) {
      const data = await res.json();
      onUpdate(sectionKey, {
        ...section,
        sectionKey,
        aiDraft: data.aiDraft,
        aiGeneratedAt: new Date().toISOString(),
      } as Section);
      setEditText(data.aiDraft);
    }
    setGenerating(false);
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/finance/reports/${reportId}/sections/${sectionKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ editedContent: editText }),
    });
    if (res.ok) {
      const updated = await res.json();
      onUpdate(sectionKey, updated);
      setEditing(false);
    }
    setSaving(false);
  }

  return (
    <div className="mt-4 border-t border-zinc-100 pt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Commentary</span>
        <div className="flex items-center gap-2">
          {!isFinal && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-md disabled:opacity-50"
            >
              {generating ? 'Drafting…' : (displayContent ? 'Regenerate' : 'Generate Commentary')}
            </button>
          )}
          {displayContent && !isFinal && !editing && (
            <button
              onClick={() => { setEditing(true); setEditText(section?.editedContent || section?.aiDraft || ''); }}
              className="text-xs px-3 py-1.5 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 rounded-md"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {generating && (
        <div className="bg-indigo-50 rounded-lg p-4 text-sm text-indigo-600 animate-pulse">Drafting commentary…</div>
      )}

      {!generating && editing ? (
        <div>
          <div className="text-[10px] text-zinc-400 mb-1 font-medium">EDITING</div>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={5}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => setEditing(false)} className="text-xs text-zinc-500 hover:text-zinc-700">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs px-3 py-1.5 bg-brand text-white rounded-md disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : !generating && displayContent ? (
        <div>
          {section?.editedContent ? (
            <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{section.editedContent}</p>
          ) : (
            <div>
              <div className="text-[10px] text-indigo-400 font-semibold mb-1">AI DRAFT</div>
              <div className="bg-blue-50 rounded-lg p-4 text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{section?.aiDraft}</div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function ReportSection({
  title,
  sectionKey,
  reportId,
  sections,
  isFinal,
  onSectionUpdate,
  children,
}: {
  title: string;
  sectionKey: string;
  reportId: string;
  sections: Section[];
  isFinal: boolean;
  onSectionUpdate: (key: string, updated: Section) => void;
  children: React.ReactNode;
}) {
  const section = sections.find((s) => s.sectionKey === sectionKey);
  return (
    <div className="bg-white border border-zinc-200 rounded-xl mb-4 overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100">
        <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
      </div>
      <div className="px-6 py-5">
        {children}
        <CommentaryPanel
          sectionKey={sectionKey}
          reportId={reportId}
          section={section}
          isFinal={isFinal}
          onUpdate={onSectionUpdate}
        />
      </div>
    </div>
  );
}

// ─── Table helpers ────────────────────────────────────────────────────────────

function TH({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wide ${right ? 'text-right' : 'text-left'}`}>{children}</th>;
}
function TD({ children, right, bold, red, green }: { children: React.ReactNode; right?: boolean; bold?: boolean; red?: boolean; green?: boolean }) {
  return (
    <td className={`px-3 py-2.5 text-sm ${right ? 'text-right' : ''} ${bold ? 'font-semibold text-zinc-900' : 'text-zinc-700'} ${red ? 'text-red-600' : ''} ${green ? 'text-green-600' : ''}`}>
      {children}
    </td>
  );
}

// ─── Main report view ─────────────────────────────────────────────────────────

export default function ReportViewClient({ report: initialReport, calculations }: { report: Report; calculations: Calculations }) {
  const router = useRouter();
  const [report, setReport] = useState(initialReport);
  const [sections, setSections] = useState<Section[]>(initialReport.sections);
  const [promoting, setPromoting] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [allCommentaryProgress, setAllCommentaryProgress] = useState('');

  const isFinal = report.status === 'FINAL';
  const { busUnit, pnl, wipSchedule, projectSummary, unsecured } = calculations;

  function handleSectionUpdate(key: string, updated: Section) {
    setSections((prev) => {
      const exists = prev.find((s) => s.sectionKey === key);
      if (exists) return prev.map((s) => s.sectionKey === key ? { ...s, ...updated } : s);
      return [...prev, updated];
    });
  }

  async function handlePromoteStatus(newStatus: 'REVIEW' | 'FINAL') {
    if (newStatus === 'FINAL' && !confirm('Mark this report as FINAL? This will lock the month and cannot be undone.')) return;
    setPromoting(true);
    const res = await fetch(`/api/finance/reports/${report.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      const updated = await res.json();
      setReport((prev) => ({ ...prev, status: updated.status, finalisedAt: updated.finalisedAt }));
    }
    setPromoting(false);
  }

  async function handleGenerateAll() {
    if (!confirm('Generate AI commentary for all sections? This will overwrite existing AI drafts.')) return;
    const SECTIONS = ['business_unit_summary', 'consolidated_pl', 'project_financial', 'wip_schedule', 'month_ahead'];
    setGeneratingAll(true);
    for (const key of SECTIONS) {
      setAllCommentaryProgress(`Generating ${key.replace(/_/g, ' ')}…`);
      try {
        const res = await fetch('/api/finance/generate-commentary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sectionKey: key, reportId: report.id }),
        });
        if (res.ok) {
          const data = await res.json();
          handleSectionUpdate(key, { sectionKey: key, aiDraft: data.aiDraft, aiGeneratedAt: new Date().toISOString() });
        }
      } catch { /* continue */ }
    }
    setAllCommentaryProgress('');
    setGeneratingAll(false);
  }

  const MONTHS = ['jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun'] as const;
  const MONTH_LABELS = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/finance/reports" className="text-sm text-zinc-400 hover:text-zinc-600">← All Reports</Link>
          </div>
          <h1 className="text-xl font-semibold text-zinc-900">Management Report — {fmtMonth(report.reportMonth)}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOURS[report.status]}`}>{report.status}</span>
            <span className="text-xs text-zinc-500">Prepared by {report.preparedBy.firstName} {report.preparedBy.lastName}</span>
            <span className="text-xs text-zinc-500">Generated {fmtDate(report.generatedAt)}</span>
            {report.finalisedAt && <span className="text-xs text-green-600">Finalised {fmtDate(report.finalisedAt)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isFinal && !generatingAll && (
            <button
              onClick={handleGenerateAll}
              disabled={generatingAll}
              className="px-3 py-2 text-sm border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-lg"
            >
              Generate All Commentary
            </button>
          )}
          {generatingAll && (
            <span className="text-sm text-indigo-600 animate-pulse">{allCommentaryProgress || 'Generating…'}</span>
          )}
          <a
            href={`/api/finance/reports/${report.id}/export`}
            target="_blank"
            className="px-3 py-2 text-sm border border-zinc-200 text-zinc-600 hover:bg-zinc-50 rounded-lg"
          >
            Export PDF
          </a>
          {report.status === 'DRAFT' && !isFinal && (
            <button
              onClick={() => handlePromoteStatus('REVIEW')}
              disabled={promoting}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {promoting ? '…' : 'Promote to Review'}
            </button>
          )}
          {report.status === 'REVIEW' && !isFinal && (
            <button
              onClick={() => handlePromoteStatus('FINAL')}
              disabled={promoting}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {promoting ? '…' : 'Mark Final'}
            </button>
          )}
        </div>
      </div>

      {/* Section 1 — Business Unit Summary */}
      <ReportSection title="Business Unit Summary" sectionKey="business_unit_summary" reportId={report.id} sections={sections} isFinal={isFinal} onSectionUpdate={handleSectionUpdate}>
        <div className="overflow-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <TH>Business Unit</TH>
                <TH right>YTD Actual $</TH>
                <TH right>YTD Budget $</TH>
                <TH right>Variance $</TH>
                <TH right>Variance %</TH>
                <TH right>Margin %</TH>
                <TH right>FY Forecast $</TH>
                <TH right>FY Budget $</TH>
                <TH right>FY Var $</TH>
                <TH right>FY Var %</TH>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {([
                { label: 'Awarded Projects', data: busUnit.awarded },
                { label: 'Backlog Projects', data: busUnit.backlog },
              ] as { label: string; data: { ytdActualMargin: number | null; ytdBudgetMargin: number; ytdVarianceDollars: number | null; ytdVariancePct: number | null; ytdMarginPct: number | null; fyForecastMargin: number; fyBudgetMargin: number | null; fyVarianceDollars: number | null; fyVariancePct: number | null } }[]).map(({ label, data }, i) => (
                <tr key={label} className={i % 2 === 0 ? '' : 'bg-zinc-50/50'}>
                  <TD bold>{label}</TD>
                  <TD right bold>{data.ytdActualMargin != null ? fmt(data.ytdActualMargin) : '—'}</TD>
                  <TD right>{fmt(data.ytdBudgetMargin)}</TD>
                  <TD right red={data.ytdVarianceDollars != null && data.ytdVarianceDollars < 0} green={data.ytdVarianceDollars != null && data.ytdVarianceDollars >= 0}>
                    {data.ytdVarianceDollars != null ? fmt(data.ytdVarianceDollars) : '—'}
                  </TD>
                  <TD right red={data.ytdVariancePct != null && data.ytdVariancePct < -0.05}>
                    {data.ytdVariancePct != null ? fmtPct(data.ytdVariancePct) : '—'}
                  </TD>
                  <TD right>{data.ytdMarginPct != null ? fmtPct(data.ytdMarginPct) : '—'}</TD>
                  <TD right bold>{fmt(data.fyForecastMargin)}</TD>
                  <TD right>{data.fyBudgetMargin != null ? fmt(data.fyBudgetMargin) : '—'}</TD>
                  <TD right red={data.fyVarianceDollars != null && data.fyVarianceDollars < 0} green={data.fyVarianceDollars != null && data.fyVarianceDollars >= 0}>
                    {data.fyVarianceDollars != null ? fmt(data.fyVarianceDollars) : '—'}
                  </TD>
                  <TD right red={data.fyVariancePct != null && data.fyVariancePct < -0.05}>
                    {data.fyVariancePct != null ? fmtPct(data.fyVariancePct) : '—'}
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex gap-8 text-sm text-zinc-600 border-t border-zinc-100 pt-4">
          <div>Net Project Cash Flow: <span className="font-semibold text-zinc-900">{busUnit.netProjectCashFlow != null ? fmt(busUnit.netProjectCashFlow) : '—'}</span></div>
          <div>Net Cash vs Gross Margin: <span className={`font-semibold ${busUnit.netCashVsGrossMargin != null && busUnit.netCashVsGrossMargin < 0 ? 'text-red-600' : 'text-zinc-900'}`}>{busUnit.netCashVsGrossMargin != null ? fmt(busUnit.netCashVsGrossMargin) : '—'}</span></div>
        </div>
      </ReportSection>

      {/* Section 2 — Consolidated P&L */}
      <ReportSection title="Consolidated P&L" sectionKey="consolidated_pl" reportId={report.id} sections={sections} isFinal={isFinal} onSectionUpdate={handleSectionUpdate}>
        <div className="overflow-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <TH>Line Item</TH>
                <TH right>This Month</TH>
                <TH right>YTD Actual</TH>
                <TH right>YTD Budget</TH>
                <TH right>Variance $</TH>
                <TH right>Variance %</TH>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {[
                { label: 'Revenue', tm: pnl.thisMonth.revenue, ytd: pnl.ytd.revenue, bud: pnl.budget.revenue, varD: pnl.variance.revenue, varP: pnl.variance.revenuePct },
                { label: 'Cost of Sales', tm: pnl.thisMonth.costOfSales, ytd: pnl.ytd.costOfSales, bud: pnl.budget.costOfSales },
                { label: 'Direct Labour', tm: pnl.thisMonth.directLabour, ytd: pnl.ytd.directLabour },
                { label: 'Gross Profit', tm: pnl.thisMonth.grossProfit, ytd: pnl.ytd.grossProfit, bud: pnl.budget.grossProfit, varD: pnl.variance.grossProfit, varP: pnl.variance.grossProfitPct, bold: true },
                { label: 'Gross Margin %', tm: pnl.thisMonth.grossMarginPct, ytd: pnl.ytd.grossMarginPct, isPct: true },
                { label: 'Indirect Expenses', tm: pnl.thisMonth.indirectExpenses, ytd: pnl.ytd.indirectExpenses },
                { label: 'Indirect Labour', tm: pnl.thisMonth.indirectLabour, ytd: pnl.ytd.indirectLabour },
                { label: 'Marketing Expenses', tm: pnl.thisMonth.marketingExpenses, ytd: pnl.ytd.marketingExpenses },
                { label: 'Net Profit Before Tax', tm: pnl.thisMonth.netProfitBeforeTax, ytd: pnl.ytd.netProfitBeforeTax, bud: pnl.budget.netProfitBeforeTax, varD: pnl.variance.netProfit, varP: pnl.variance.netProfitPct, bold: true },
                { label: 'Net Profit Rate %', tm: pnl.thisMonth.netProfitRate, ytd: pnl.ytd.netProfitRate, isPct: true },
              ].map((row, i) => (
                <tr key={row.label} className={i % 2 === 0 ? '' : 'bg-zinc-50/50'}>
                  <TD bold={row.bold}>{row.label}</TD>
                  <TD right bold={row.bold}>{row.isPct ? fmtPct(row.tm ?? 0) : fmt(row.tm ?? 0)}</TD>
                  <TD right bold={row.bold}>{row.isPct ? fmtPct(row.ytd ?? 0) : fmt(row.ytd ?? 0)}</TD>
                  <TD right>{row.bud != null ? fmt(row.bud) : '—'}</TD>
                  <TD right red={row.varD != null && row.varD < 0} green={row.varD != null && row.varD >= 0}>{row.varD != null ? fmt(row.varD) : '—'}</TD>
                  <TD right red={row.varP != null && row.varP < -0.1}>{row.varP != null ? fmtPct(row.varP) : '—'}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportSection>

      {/* Section 3 — Project Financial Summary */}
      <ReportSection title="Project Financial Summary — Revenue Side" sectionKey="project_financial" reportId={report.id} sections={sections} isFinal={isFinal} onSectionUpdate={handleSectionUpdate}>
        <div className="overflow-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <TH>Job No</TH><TH>Project</TH><TH>Status</TH>
                <TH right>Contract Value</TH><TH right>Forecast Costs</TH>
                <TH right>Margin $</TH><TH right>Margin %</TH><TH right>Target %</TH>
                <TH right>Claim Total</TH><TH right>Retention</TH><TH>Flag</TH>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(['AWARDED', 'BACKLOG', 'DLP', 'CLOSED'] as const).map((status) => {
                const rows = projectSummary.filter((p: { status: string }) => p.status === status);
                if (rows.length === 0) return null;
                const stCV = rows.reduce((s: number, p: { forecastContractValue: number }) => s + p.forecastContractValue, 0);
                const stM = rows.reduce((s: number, p: { forecastMarginDollars: number }) => s + p.forecastMarginDollars, 0);
                return (
                  <>
                    {rows.map((p: { jobNumber: string; projectName: string; status: string; forecastContractValue: number; forecastFinalCosts: number; forecastMarginDollars: number; forecastMarginPercent: number; targetExitMarginPercent: number | null; claimTotal: number; claimRetention: number; flag: string; costToCompleteEstimated: boolean }, i: number) => (
                      <tr key={p.jobNumber} className={i % 2 === 0 ? '' : 'bg-zinc-50/50'}>
                        <TD><span className="font-mono text-xs">{p.jobNumber}</span></TD>
                        <TD>{p.projectName}</TD>
                        <TD><span className="text-xs text-zinc-500">{p.status}</span></TD>
                        <TD right>{fmt(p.forecastContractValue)}</TD>
                        <TD right>{fmt(p.forecastFinalCosts)}</TD>
                        <TD right bold>{fmt(p.forecastMarginDollars)}</TD>
                        <TD right>{fmtPct(p.forecastMarginPercent)}</TD>
                        <TD right>{p.targetExitMarginPercent ? fmtPct(p.targetExitMarginPercent) : '—'}</TD>
                        <TD right>{fmt(p.claimTotal)}</TD>
                        <TD right>{fmt(p.claimRetention)}</TD>
                        <TD>
                          {p.costToCompleteEstimated ? (
                            <span className="inline-flex px-1.5 py-0.5 rounded text-xs bg-zinc-100 text-zinc-500">EST</span>
                          ) : (
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-semibold ${FLAG_COLOURS[p.flag]}`}>{p.flag}</span>
                          )}
                        </TD>
                      </tr>
                    ))}
                    <tr className="bg-orange-50">
                      <td colSpan={3} className="px-3 py-2 text-xs font-bold text-zinc-700">{status} SUBTOTAL</td>
                      <TD right bold>{fmt(stCV)}</TD>
                      <td />
                      <TD right bold>{fmt(stM)}</TD>
                      <TD right bold>{stCV > 0 ? fmtPct(stM / stCV) : '—'}</TD>
                      <td /><td /><td /><td />
                    </tr>
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </ReportSection>

      {/* Section 4 — Project Financial Summary Cost Side */}
      <div className="bg-white border border-zinc-200 rounded-xl mb-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h2 className="text-base font-semibold text-zinc-900">Project Financial Summary — Cost Side</h2>
        </div>
        <div className="px-6 py-5 overflow-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <TH>Job No</TH><TH>Project</TH>
                <TH right>Sub Claims</TH><TH right>Creditors</TH><TH right>Labour</TH>
                <TH right>Labour Bench (4.5%)</TH><TH right>Labour Var</TH>
                <TH right>Sub Bench (70.5%)</TH><TH right>Sub Var</TH>
                <TH right>Total Cost</TH>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {projectSummary.map((p: { jobNumber: string; projectName: string; subClaims: number; creditors: number; labour: number; labourBenchmark: number; labourVariance: number; subBenchmark: number; subVariance: number; totalCost: number }, i: number) => (
                <tr key={p.jobNumber} className={i % 2 === 0 ? '' : 'bg-zinc-50/50'}>
                  <TD><span className="font-mono text-xs">{p.jobNumber}</span></TD>
                  <TD>{p.projectName}</TD>
                  <TD right>{fmt(p.subClaims)}</TD>
                  <TD right>{fmt(p.creditors)}</TD>
                  <TD right>{fmt(p.labour)}</TD>
                  <TD right>{fmt(p.labourBenchmark)}</TD>
                  <TD right red={p.labourVariance > 0} green={p.labourVariance <= 0}>{fmt(p.labourVariance)}</TD>
                  <TD right>{fmt(p.subBenchmark)}</TD>
                  <TD right red={p.subVariance > 0} green={p.subVariance <= 0}>{fmt(p.subVariance)}</TD>
                  <TD right bold>{fmt(p.totalCost)}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 5 — WIP Schedule */}
      <ReportSection title="WIP Schedule" sectionKey="wip_schedule" reportId={report.id} sections={sections} isFinal={isFinal} onSectionUpdate={handleSectionUpdate}>
        <div className="overflow-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <TH>Project</TH>
                <TH right>Contract Value</TH><TH right>Est. Total Cost</TH>
                <TH right>Costs to Date</TH><TH right>% Complete</TH>
                <TH right>Earned Revenue</TH><TH right>Billed to Date</TH>
                <TH right>Over/Underbilled</TH>
                <TH right>Est. GP</TH><TH right>Est. GP %</TH>
                <TH>Flag</TH>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {wipSchedule.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-sm text-zinc-400">No active projects for this month.</td></tr>
              ) : wipSchedule.map((w: { projectName: string; contractValue: number; estimatedTotalCost: number; costsToDate: number; pctComplete: number; earnedRevenue: number; billedToDate: number; overbilledUnderbilled: number; estimatedGrossProfit: number; estimatedGpPct: number; flag: string; costToCompleteEstimated: boolean; flagReason?: string | null }, i: number) => (
                <tr key={w.projectName} className={i % 2 === 0 ? '' : 'bg-zinc-50/50'}>
                  <TD>{w.projectName}</TD>
                  <TD right>{fmt(w.contractValue)}</TD>
                  <TD right>{fmt(w.estimatedTotalCost)}</TD>
                  <TD right>{fmt(w.costsToDate)}</TD>
                  <TD right>{fmtPct(w.pctComplete)}</TD>
                  <TD right>{fmt(w.earnedRevenue)}</TD>
                  <TD right>{fmt(w.billedToDate)}</TD>
                  <TD right red={w.overbilledUnderbilled < 0} green={w.overbilledUnderbilled >= 0}>{fmt(w.overbilledUnderbilled)}</TD>
                  <TD right>{fmt(w.estimatedGrossProfit)}</TD>
                  <TD right>{fmtPct(w.estimatedGpPct)}</TD>
                  <td className="px-3 py-2.5" title={w.flagReason ?? undefined}>
                    {w.costToCompleteEstimated ? (
                      <span className="inline-flex px-1.5 py-0.5 rounded text-xs bg-zinc-100 text-zinc-500" title="Cost to complete not entered — using estimate">EST</span>
                    ) : (
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-semibold ${FLAG_COLOURS[w.flag]}`}>{w.flag}</span>
                    )}
                  </td>
                </tr>
              ))}
              {wipSchedule.length > 0 && (
                <tr className="bg-zinc-50 border-t border-zinc-200">
                  <td className="px-3 py-2 text-xs font-bold text-zinc-700">TOTALS</td>
                  <TD right bold>{fmt(wipSchedule.reduce((s: number, w: { contractValue: number }) => s + w.contractValue, 0))}</TD>
                  <TD right bold>{fmt(wipSchedule.reduce((s: number, w: { estimatedTotalCost: number }) => s + w.estimatedTotalCost, 0))}</TD>
                  <TD right bold>{fmt(wipSchedule.reduce((s: number, w: { costsToDate: number }) => s + w.costsToDate, 0))}</TD>
                  <td />
                  <TD right bold>{fmt(wipSchedule.reduce((s: number, w: { earnedRevenue: number }) => s + w.earnedRevenue, 0))}</TD>
                  <TD right bold>{fmt(wipSchedule.reduce((s: number, w: { billedToDate: number }) => s + w.billedToDate, 0))}</TD>
                  <TD right bold>{fmt(wipSchedule.reduce((s: number, w: { overbilledUnderbilled: number }) => s + w.overbilledUnderbilled, 0))}</TD>
                  <TD right bold>{fmt(wipSchedule.reduce((s: number, w: { estimatedGrossProfit: number }) => s + w.estimatedGrossProfit, 0))}</TD>
                  <td /><td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ReportSection>

      {/* Section 6 — Unsecured Forecast */}
      <ReportSection title={`Unsecured Forecast — FY${unsecured.financialYear}/${unsecured.financialYear + 1}`} sectionKey="unsecured_forecast" reportId={report.id} sections={sections} isFinal={isFinal} onSectionUpdate={handleSectionUpdate}>
        <div className="overflow-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <TH>Row</TH>
                {MONTH_LABELS.map((m) => <TH key={m} right>{m}</TH>)}
                <TH right>Next Yr</TH>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {[
                { label: '100% Revenue', data: unsecured.fullRevenue, nextYear: unsecured.nextYearFull },
                { label: 'Probability-Weighted Revenue', data: unsecured.weightedRevenue, nextYear: unsecured.nextYearWeighted },
                { label: 'Probability-Weighted Margin', data: unsecured.weightedMargin, nextYear: unsecured.nextYearMargin },
              ].map((row, i) => (
                <tr key={row.label} className={i % 2 === 0 ? '' : 'bg-zinc-50/50'}>
                  <TD bold>{row.label}</TD>
                  {MONTHS.map((m) => <TD key={m} right>{fmt(row.data[m] ?? 0)}</TD>)}
                  <TD right>{fmt(row.nextYear)}</TD>
                </tr>
              ))}
            </tbody>
          </table>
          {Object.values(unsecured.fullRevenue).every((v) => (v as number) === 0) && (
            <p className="text-xs text-zinc-400 mt-2">No planned deal revenue records found for this financial year. Add deals in the Planned Work section to populate this table.</p>
          )}
        </div>
      </ReportSection>

      {/* Section 7 — Month Ahead */}
      <ReportSection title="Month Ahead" sectionKey="month_ahead" reportId={report.id} sections={sections} isFinal={isFinal} onSectionUpdate={handleSectionUpdate}>
        <p className="text-sm text-zinc-500">Generate AI commentary to populate this section with forward-looking analysis.</p>
      </ReportSection>

      {/* Section 8 — Operational Alerts */}
      <div className="bg-white border border-zinc-200 rounded-xl mb-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h2 className="text-base font-semibold text-zinc-900">Operational Alerts Checklist</h2>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-zinc-500 mb-4">Confirm the status of operational items for this reporting period.</p>
          <div className="space-y-2">
            {[
              'No HSE incidents this month requiring regulatory notification',
              'All mandatory insurance policies current',
              'No legal matters requiring director attention',
              'Quality management system — no non-conformances',
              'HR — no matters requiring director attention',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 py-2 border-b border-zinc-50">
                <span className="w-4 h-4 rounded border border-zinc-300 flex-shrink-0" />
                <span className="text-sm text-zinc-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Placeholder sections */}
      {['Labour Allocation', 'Project Performance Scorecard', 'Strategic KPIs'].map((title) => (
        <div key={title} className="bg-zinc-50 border border-dashed border-zinc-200 rounded-xl mb-4 px-6 py-8 text-center">
          <p className="text-sm text-zinc-400 font-medium">{title}</p>
          <p className="text-xs text-zinc-300 mt-1">Coming in a future sprint</p>
        </div>
      ))}
    </div>
  );
}
