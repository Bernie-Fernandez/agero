'use client';
import { useState } from 'react';

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
  tradeSectionId: string | null;
  areaId: string | null;
  tradeSection: { id: string; name: string; code: string | null } | null;
  area: { id: string; name: string } | null;
};

type TradeSection = { id: string; name: string; code: string | null };
type Area = { id: string; name: string };

type Estimate = {
  id: string;
  targetGpPct: number | string;
  minGpPct: number | string;
  defaultMarkupPct: number | string;
  costRecoveryPct: number | string;
  tradeSections: TradeSection[];
  areas: Area[];
  lines: Line[];
};

type Tab = 'section' | 'type' | 'area' | 'flags' | 'margin';

function fmt(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);
}

function pct(n: number) { return `${n.toFixed(2)}%`; }

const TYPE_LABELS: Record<string, string> = {
  LABOUR: 'Labour', MATERIAL: 'Material', SUBCONTRACTOR: 'Subcontractor',
  ALLOWANCE: 'Allowance', PROVISIONAL_SUM: 'Provisional Sum',
};

export default function AnalysisClient({ estimate }: { estimate: Estimate }) {
  const [tab, setTab] = useState<Tab>('section');

  const baseLines = estimate.lines.filter((l) => !l.isOption && !l.isLockaway);
  const totalCost = baseLines.reduce((s, l) => s + Number(l.total), 0);
  const markup = Number(estimate.defaultMarkupPct) / 100;
  const costRecovery = Number(estimate.costRecoveryPct) / 100;
  const gross = totalCost * (1 + markup) * (1 + costRecovery);
  const gpPct = gross > 0 ? ((gross - totalCost) / gross) * 100 : 0;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'section', label: 'By Trade Section' },
    { key: 'type', label: 'By Type' },
    { key: 'area', label: 'By Area' },
    { key: 'flags', label: 'Flags' },
    { key: 'margin', label: 'Margin Analysis' },
  ];

  function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
    const result: Record<string, T[]> = {};
    for (const item of items) {
      const key = keyFn(item);
      (result[key] = result[key] ?? []).push(item);
    }
    return result;
  }

  function renderBreakdownTable(rows: { label: string; cost: number; count: number }[]) {
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200">
            <th className="py-2 text-left text-xs font-semibold text-zinc-500">Category</th>
            <th className="py-2 text-right text-xs font-semibold text-zinc-500">Lines</th>
            <th className="py-2 text-right text-xs font-semibold text-zinc-500">Cost</th>
            <th className="py-2 text-right text-xs font-semibold text-zinc-500">% of Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.sort((a, b) => b.cost - a.cost).map((row) => (
            <tr key={row.label} className="border-b border-zinc-100">
              <td className="py-2 text-zinc-800">{row.label}</td>
              <td className="py-2 text-right text-zinc-500">{row.count}</td>
              <td className="py-2 text-right font-medium text-zinc-900">{fmt(row.cost)}</td>
              <td className="py-2 text-right text-zinc-500">{totalCost > 0 ? pct((row.cost / totalCost) * 100) : '—'}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-zinc-200 font-semibold">
            <td className="py-2 text-zinc-700">Total</td>
            <td className="py-2 text-right text-zinc-700">{rows.reduce((s, r) => s + r.count, 0)}</td>
            <td className="py-2 text-right text-zinc-900">{fmt(totalCost)}</td>
            <td className="py-2 text-right text-zinc-700">100%</td>
          </tr>
        </tbody>
      </table>
    );
  }

  return (
    <div className="h-full overflow-auto bg-zinc-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-0 border-b border-zinc-200 mb-6 bg-white rounded-t-lg overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                tab === t.key ? 'border-brand text-brand font-medium' : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-b-lg border border-zinc-200 p-6">
          {tab === 'section' && (() => {
            const grouped = groupBy(baseLines, (l) => l.tradeSectionId ?? '__none');
            const rows = Object.entries(grouped).map(([sectionId, lines]) => {
              const section = estimate.tradeSections.find((s) => s.id === sectionId);
              return {
                label: section ? `${section.code ? section.code + ' — ' : ''}${section.name}` : 'Unassigned',
                cost: lines.reduce((s, l) => s + Number(l.total), 0),
                count: lines.length,
              };
            });
            return renderBreakdownTable(rows);
          })()}

          {tab === 'type' && (() => {
            const grouped = groupBy(baseLines, (l) => l.type);
            const rows = Object.entries(grouped).map(([type, lines]) => ({
              label: TYPE_LABELS[type] ?? type,
              cost: lines.reduce((s, l) => s + Number(l.total), 0),
              count: lines.length,
            }));
            return renderBreakdownTable(rows);
          })()}

          {tab === 'area' && (() => {
            const grouped = groupBy(baseLines, (l) => l.areaId ?? '__none');
            const rows = Object.entries(grouped).map(([areaId, lines]) => {
              const area = estimate.areas.find((a) => a.id === areaId);
              return {
                label: area?.name ?? 'No Area',
                cost: lines.reduce((s, l) => s + Number(l.total), 0),
                count: lines.length,
              };
            });
            return renderBreakdownTable(rows);
          })()}

          {tab === 'flags' && (() => {
            const flags: { key: keyof Line; label: string; color: string }[] = [
              { key: 'isRisk', label: 'Risk & Opportunity (R&O)', color: 'text-amber-600' },
              { key: 'isOption', label: 'Options', color: 'text-purple-600' },
              { key: 'isPcSum', label: 'PC Sums', color: 'text-blue-600' },
              { key: 'isLockaway', label: 'Lockaway Items', color: 'text-orange-600' },
            ];
            return (
              <div className="space-y-6">
                {flags.map((flag) => {
                  const flaggedLines = estimate.lines.filter((l) => l[flag.key]);
                  const cost = flaggedLines.reduce((s, l) => s + Number(l.total), 0);
                  return (
                    <div key={flag.key}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className={`text-sm font-semibold ${flag.color}`}>{flag.label}</h3>
                        <span className="text-sm font-bold text-zinc-900">{fmt(cost)} ({flaggedLines.length} lines)</span>
                      </div>
                      {flaggedLines.length > 0 ? (
                        <table className="w-full text-xs">
                          <tbody>
                            {flaggedLines.map((l) => (
                              <tr key={l.id} className="border-b border-zinc-100">
                                <td className="py-1.5 text-zinc-700">{l.description}</td>
                                <td className="py-1.5 text-right text-zinc-600">{fmt(Number(l.total))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-xs text-zinc-400">No {flag.label.toLowerCase()} flagged.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {tab === 'margin' && (
            <div className="space-y-4">
              {[
                { label: 'Total Cost', value: fmt(totalCost) },
                { label: `Markup (${Number(estimate.defaultMarkupPct).toFixed(2)}%)`, value: fmt(totalCost * markup) },
                { label: `Cost Recovery (${Number(estimate.costRecoveryPct).toFixed(2)}%)`, value: fmt(totalCost * (1 + markup) * costRecovery) },
                { label: 'Gross Revenue', value: fmt(gross), bold: true },
                { label: 'Gross Profit', value: fmt(gross - totalCost), bold: true },
                { label: 'GP %', value: pct(gpPct), highlight: true, good: gpPct >= Number(estimate.targetGpPct), warn: gpPct >= Number(estimate.minGpPct) },
                { label: 'Target GP %', value: pct(Number(estimate.targetGpPct)) },
                { label: 'Min GP %', value: pct(Number(estimate.minGpPct)) },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b border-zinc-100">
                  <span className="text-sm text-zinc-600">{row.label}</span>
                  <span className={`text-sm font-${row.bold || row.highlight ? 'bold' : 'medium'} ${
                    row.highlight ? (row.good ? 'text-green-600' : row.warn ? 'text-amber-600' : 'text-red-600') : 'text-zinc-900'
                  }`}>{row.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
