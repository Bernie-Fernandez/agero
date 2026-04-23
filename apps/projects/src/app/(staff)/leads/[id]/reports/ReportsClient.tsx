'use client';
import { useState } from 'react';
import { showToast, ToastContainer } from '@/components/Toast';

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
  tradeSectionId: string | null;
  tradeSection: { id: string; name: string; code: string | null } | null;
  area: { id: string; name: string } | null;
};

type TradeSection = { id: string; name: string; code: string | null };
type Snapshot = { id: string; label: string; snapshotData: Record<string, unknown>; createdAt: Date | string; createdBy: { firstName: string; lastName: string } };

type Estimate = {
  id: string;
  leadNumber: string;
  title: string;
  status: string;
  targetGpPct: number | string;
  minGpPct: number | string;
  defaultMarkupPct: number | string;
  costRecoveryPct: number | string;
  client: { name: string } | null;
  createdBy: { firstName: string; lastName: string };
  tradeSections: TradeSection[];
  lines: Line[];
  snapshots: Snapshot[];
};

type ReportType = 'cost-plan' | 'summary' | 'trade-section' | 'flags' | 'snapshot-comparison';

const REPORT_TYPES: { key: ReportType; label: string; desc: string }[] = [
  { key: 'cost-plan', label: 'Full Cost Plan', desc: 'All line items with quantities, rates and totals' },
  { key: 'summary', label: 'Executive Summary', desc: 'KPIs and margin analysis for client presentation' },
  { key: 'trade-section', label: 'Trade Section Breakdown', desc: 'Cost breakdown by trade section' },
  { key: 'flags', label: 'Flags Report', desc: 'All R&O, Option, PC Sum and Lockaway items' },
  { key: 'snapshot-comparison', label: 'Snapshot Comparison', desc: 'Compare cost plan changes over time' },
];

function fmt(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);
}

function pct(n: number) { return `${n.toFixed(2)}%`; }

export default function ReportsClient({ estimate }: { estimate: Estimate }) {
  const [reportType, setReportType] = useState<ReportType>('cost-plan');
  const [generating, setGenerating] = useState(false);

  const baseLines = estimate.lines.filter((l) => !l.isHidden && !l.isOption && !l.isLockaway);
  const totalCost = baseLines.reduce((s, l) => s + Number(l.total), 0);
  const markup = Number(estimate.defaultMarkupPct) / 100;
  const costRecovery = Number(estimate.costRecoveryPct) / 100;
  const gross = totalCost * (1 + markup) * (1 + costRecovery);
  const gpPct = gross > 0 ? ((gross - totalCost) / gross) * 100 : 0;

  async function handleExcelExport() {
    setGenerating(true);
    try {
      const { utils, writeFile } = await import('xlsx');
      const wb = utils.book_new();

      if (reportType === 'cost-plan') {
        const data = [
          ['Lead No.', estimate.leadNumber],
          ['Title', estimate.title],
          ['Client', estimate.client?.name ?? ''],
          ['Date', new Date().toLocaleDateString('en-AU')],
          [],
          ['Code', 'Description', 'Type', 'Qty', 'Unit', 'Rate', 'Total', 'Area', 'Flags'],
          ...estimate.lines.map((l) => [
            l.tradeSection?.code ?? '',
            l.description,
            l.type,
            Number(l.quantity),
            l.unit ?? '',
            Number(l.rate),
            Number(l.total),
            l.area?.name ?? '',
            [l.isRisk && 'R&O', l.isOption && 'OPT', l.isPcSum && 'PC', l.isLockaway && 'LOCK', l.isHidden && 'HID'].filter(Boolean).join(', '),
          ]),
          [],
          ['', '', '', '', '', 'Total Cost', totalCost],
          ['', '', '', '', '', 'Gross Revenue', gross],
          ['', '', '', '', '', 'GP %', gpPct / 100],
        ];
        const ws = utils.aoa_to_sheet(data);
        utils.book_append_sheet(wb, ws, 'Cost Plan');
      }

      if (reportType === 'trade-section') {
        const sectionMap: Record<string, number> = {};
        for (const line of baseLines) {
          const key = line.tradeSectionId ?? '__none';
          sectionMap[key] = (sectionMap[key] ?? 0) + Number(line.total);
        }
        const rows = estimate.tradeSections.map((s) => {
          const cost = sectionMap[s.id] ?? 0;
          return [s.code ?? '', s.name, cost, totalCost > 0 ? cost / totalCost : 0];
        });
        const ws = utils.aoa_to_sheet([
          ['Lead No.', estimate.leadNumber, '', 'Title', estimate.title],
          [],
          ['Code', 'Section', 'Cost', '% of Total'],
          ...rows,
          [],
          ['', 'Total', totalCost, 1],
        ]);
        utils.book_append_sheet(wb, ws, 'Trade Sections');
      }

      if (reportType === 'summary') {
        const ws = utils.aoa_to_sheet([
          ['EXECUTIVE SUMMARY'],
          [],
          ['Project', estimate.title],
          ['Client', estimate.client?.name ?? ''],
          ['Lead No.', estimate.leadNumber],
          ['Status', estimate.status],
          ['Prepared By', `${estimate.createdBy.firstName} ${estimate.createdBy.lastName}`],
          ['Date', new Date().toLocaleDateString('en-AU')],
          [],
          ['FINANCIALS'],
          ['Total Cost', totalCost],
          ['Gross Revenue', gross],
          ['Gross Profit', gross - totalCost],
          ['GP %', gpPct / 100],
          ['Target GP %', Number(estimate.targetGpPct) / 100],
          ['Minimum GP %', Number(estimate.minGpPct) / 100],
        ]);
        utils.book_append_sheet(wb, ws, 'Summary');
      }

      if (reportType === 'flags') {
        const flagData = [
          ['RISK & OPPORTUNITY LINES'],
          ['Description', 'Total'],
          ...estimate.lines.filter((l) => l.isRisk).map((l) => [l.description, Number(l.total)]),
          [],
          ['OPTIONS'],
          ['Description', 'Total'],
          ...estimate.lines.filter((l) => l.isOption).map((l) => [l.description, Number(l.total)]),
          [],
          ['PC SUMS'],
          ['Description', 'Total'],
          ...estimate.lines.filter((l) => l.isPcSum).map((l) => [l.description, Number(l.total)]),
          [],
          ['LOCKAWAY ITEMS'],
          ['Description', 'Total'],
          ...estimate.lines.filter((l) => l.isLockaway).map((l) => [l.description, Number(l.total)]),
        ];
        const ws = utils.aoa_to_sheet(flagData);
        utils.book_append_sheet(wb, ws, 'Flags');
      }

      if (reportType === 'snapshot-comparison') {
        const snapshotData = [
          ['Snapshot', 'Date', 'Created By', 'Lines', 'Total Cost'],
          ...estimate.snapshots.map((s) => {
            const data = s.snapshotData as Record<string, string>;
            return [
              s.label,
              new Date(s.createdAt).toLocaleDateString('en-AU'),
              `${s.createdBy.firstName} ${s.createdBy.lastName}`,
              data.lineCount ?? '',
              data.totalCost ? Number(data.totalCost) : '',
            ];
          }),
        ];
        const ws = utils.aoa_to_sheet(snapshotData);
        utils.book_append_sheet(wb, ws, 'Snapshots');
      }

      writeFile(wb, `${estimate.leadNumber}-${reportType}.xlsx`);
      showToast('Excel exported');
    } catch (err) {
      showToast('Export failed', 'error');
    } finally {
      setGenerating(false);
    }
  }

  function handlePrintPdf() {
    window.print();
  }

  return (
    <div className="h-full overflow-auto bg-zinc-50 p-6">
      <ToastContainer />
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-800">Reports</h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrintPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-zinc-200 rounded-md bg-white hover:bg-zinc-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              PDF / Print
            </button>
            <button
              onClick={handleExcelExport}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
              {generating ? 'Generating…' : 'Export Excel'}
            </button>
          </div>
        </div>

        {/* Report type selector */}
        <div className="grid grid-cols-5 gap-3">
          {REPORT_TYPES.map((rt) => (
            <button
              key={rt.key}
              onClick={() => setReportType(rt.key)}
              className={`p-4 rounded-lg border text-left transition-colors ${
                reportType === rt.key ? 'border-brand bg-brand/5' : 'border-zinc-200 bg-white hover:border-zinc-300'
              }`}
            >
              <p className={`text-xs font-semibold mb-1 ${reportType === rt.key ? 'text-brand' : 'text-zinc-800'}`}>{rt.label}</p>
              <p className="text-xs text-zinc-500">{rt.desc}</p>
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="bg-white border border-zinc-200 rounded-lg p-6 print:shadow-none" id="report-preview">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-200">
            <div>
              <h1 className="text-lg font-bold text-zinc-900">{estimate.title}</h1>
              <p className="text-sm text-zinc-500">{estimate.leadNumber} {estimate.client && `· ${estimate.client.name}`}</p>
            </div>
            <div className="text-right text-sm text-zinc-500">
              <p>{REPORT_TYPES.find((r) => r.key === reportType)?.label}</p>
              <p>{new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
          </div>

          {reportType === 'cost-plan' && (
            <table className="w-full text-xs">
              <thead><tr className="border-b border-zinc-200"><th className="py-1.5 text-left text-zinc-500">Code</th><th className="py-1.5 text-left text-zinc-500">Description</th><th className="py-1.5 text-right text-zinc-500">Qty</th><th className="py-1.5 text-left text-zinc-500">Unit</th><th className="py-1.5 text-right text-zinc-500">Rate</th><th className="py-1.5 text-right text-zinc-500">Total</th></tr></thead>
              <tbody>
                {estimate.tradeSections.map((section) => {
                  const sectionLines = estimate.lines.filter((l) => l.tradeSectionId === section.id && !l.isHidden);
                  if (sectionLines.length === 0) return null;
                  return (
                    <>
                      <tr key={`s-${section.id}`} className="bg-zinc-50"><td colSpan={5} className="py-1.5 px-1 font-semibold text-zinc-700">{section.code && <span className="text-zinc-400 mr-1">{section.code}</span>}{section.name}</td><td className="py-1.5 text-right font-bold text-zinc-800">{fmt(sectionLines.reduce((s, l) => s + Number(l.total), 0))}</td></tr>
                      {sectionLines.map((l) => (
                        <tr key={l.id} className="border-b border-zinc-50">
                          <td className="py-1 text-zinc-400"></td>
                          <td className="py-1 text-zinc-700">{l.description}</td>
                          <td className="py-1 text-right text-zinc-600">{Number(l.quantity).toFixed(2)}</td>
                          <td className="py-1 text-zinc-500">{l.unit ?? ''}</td>
                          <td className="py-1 text-right text-zinc-600">{fmt(Number(l.rate))}</td>
                          <td className="py-1 text-right font-medium text-zinc-800">{fmt(Number(l.total))}</td>
                        </tr>
                      ))}
                    </>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-zinc-200">
                <tr><td colSpan={5} className="py-2 font-semibold text-zinc-700 text-right">Total Cost</td><td className="py-2 text-right font-bold text-zinc-900">{fmt(totalCost)}</td></tr>
                <tr><td colSpan={5} className="py-1.5 text-zinc-500 text-right text-xs">Gross Revenue</td><td className="py-1.5 text-right text-zinc-700 text-xs font-medium">{fmt(gross)}</td></tr>
                <tr><td colSpan={5} className="py-1.5 text-zinc-500 text-right text-xs">GP %</td><td className={`py-1.5 text-right text-xs font-bold ${gpPct >= Number(estimate.targetGpPct) ? 'text-green-600' : 'text-red-600'}`}>{pct(gpPct)}</td></tr>
              </tfoot>
            </table>
          )}

          {reportType === 'summary' && (
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-zinc-700 mb-2">Financial Summary</h3>
                {[
                  { label: 'Total Cost', value: fmt(totalCost) },
                  { label: 'Gross Revenue', value: fmt(gross) },
                  { label: 'Gross Profit', value: fmt(gross - totalCost) },
                  { label: 'GP %', value: pct(gpPct), color: gpPct >= Number(estimate.targetGpPct) ? 'text-green-600' : 'text-red-600' },
                  { label: 'Target GP %', value: pct(Number(estimate.targetGpPct)) },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between border-b border-zinc-100 pb-2">
                    <span className="text-sm text-zinc-600">{row.label}</span>
                    <span className={`text-sm font-semibold ${row.color ?? 'text-zinc-900'}`}>{row.value}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-zinc-700 mb-2">Cost by Section</h3>
                {estimate.tradeSections.map((s) => {
                  const cost = baseLines.filter((l) => l.tradeSectionId === s.id).reduce((sum, l) => sum + Number(l.total), 0);
                  if (cost === 0) return null;
                  return (
                    <div key={s.id} className="flex justify-between text-xs border-b border-zinc-100 pb-1.5">
                      <span className="text-zinc-600">{s.name}</span>
                      <span className="font-medium text-zinc-800">{fmt(cost)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {reportType === 'trade-section' && (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-zinc-200"><th className="py-2 text-left text-xs font-semibold text-zinc-500">Section</th><th className="py-2 text-right text-xs font-semibold text-zinc-500">Cost</th><th className="py-2 text-right text-xs font-semibold text-zinc-500">% of Total</th></tr></thead>
              <tbody>
                {estimate.tradeSections.map((s) => {
                  const cost = baseLines.filter((l) => l.tradeSectionId === s.id).reduce((sum, l) => sum + Number(l.total), 0);
                  return (
                    <tr key={s.id} className="border-b border-zinc-100">
                      <td className="py-2 text-zinc-800">{s.code && <span className="text-zinc-400 mr-1.5">{s.code}</span>}{s.name}</td>
                      <td className="py-2 text-right font-medium text-zinc-900">{fmt(cost)}</td>
                      <td className="py-2 text-right text-zinc-500">{totalCost > 0 ? pct((cost / totalCost) * 100) : '—'}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-zinc-200 font-semibold"><td className="py-2 text-zinc-700">Total</td><td className="py-2 text-right text-zinc-900">{fmt(totalCost)}</td><td className="py-2 text-right text-zinc-700">100%</td></tr>
              </tbody>
            </table>
          )}

          {reportType === 'flags' && (
            <div className="space-y-6 text-sm">
              {[
                { key: 'isRisk' as const, label: 'Risk & Opportunity (R&O)', color: 'text-amber-700' },
                { key: 'isOption' as const, label: 'Options', color: 'text-purple-700' },
                { key: 'isPcSum' as const, label: 'PC Sums', color: 'text-blue-700' },
                { key: 'isLockaway' as const, label: 'Lockaway Items', color: 'text-orange-700' },
              ].map((flag) => {
                const flagLines = estimate.lines.filter((l) => l[flag.key]);
                const total = flagLines.reduce((s, l) => s + Number(l.total), 0);
                return (
                  <div key={flag.key}>
                    <h3 className={`font-semibold mb-2 ${flag.color}`}>{flag.label} — {fmt(total)}</h3>
                    {flagLines.length === 0 ? <p className="text-xs text-zinc-400">None.</p> : (
                      <table className="w-full text-xs"><tbody>
                        {flagLines.map((l) => <tr key={l.id} className="border-b border-zinc-100"><td className="py-1 text-zinc-700">{l.description}</td><td className="py-1 text-right text-zinc-800 font-medium">{fmt(Number(l.total))}</td></tr>)}
                      </tbody></table>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {reportType === 'snapshot-comparison' && (
            <div>
              {estimate.snapshots.length === 0 ? (
                <p className="text-sm text-zinc-400">No snapshots taken yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-zinc-200"><th className="py-2 text-left text-xs font-semibold text-zinc-500">Label</th><th className="py-2 text-left text-xs font-semibold text-zinc-500">Date</th><th className="py-2 text-left text-xs font-semibold text-zinc-500">By</th><th className="py-2 text-right text-xs font-semibold text-zinc-500">Lines</th><th className="py-2 text-right text-xs font-semibold text-zinc-500">Total Cost</th></tr></thead>
                  <tbody>
                    {estimate.snapshots.map((s) => {
                      const data = s.snapshotData as Record<string, string>;
                      return (
                        <tr key={s.id} className="border-b border-zinc-100">
                          <td className="py-2 text-zinc-800 font-medium">{s.label}</td>
                          <td className="py-2 text-zinc-500 text-xs">{new Date(s.createdAt).toLocaleDateString('en-AU')}</td>
                          <td className="py-2 text-zinc-500 text-xs">{s.createdBy.firstName}</td>
                          <td className="py-2 text-right text-zinc-600">{data.lineCount ?? '—'}</td>
                          <td className="py-2 text-right font-medium text-zinc-900">{data.totalCost ? fmt(Number(data.totalCost)) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
