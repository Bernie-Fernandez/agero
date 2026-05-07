'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Report = {
  id: string;
  reportMonth: string;
  status: 'DRAFT' | 'REVIEW' | 'FINAL';
  generatedAt: string;
  preparedBy: { firstName: string; lastName: string };
  _count: { sections: number };
};

type MonthStatus = { reportMonth: string; status: string };
type AvailableMonth = { reportMonth: string };

const STATUS_COLOURS: Record<string, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-600',
  REVIEW: 'bg-amber-100 text-amber-700',
  FINAL: 'bg-green-100 text-green-700',
};

function fmtMonth(s: string) {
  return new Date(s).toLocaleDateString('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function DataReadinessPanel({ month, monthStatuses }: { month: string; monthStatuses: MonthStatus[] }) {
  const ms = monthStatuses.find((m) => m.reportMonth.startsWith(month.substring(0, 7)));
  const xeroSynced = ms && (ms.status === 'SYNCED' || ms.status === 'LOCKED' || ms.status === 'READY');
  const locked = ms?.status === 'LOCKED';

  return (
    <div className="bg-zinc-50 rounded-lg p-4 mb-6">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Data Readiness — {fmtMonth(month + '-01')}</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Xero Synced', ok: !!xeroSynced },
          { label: 'Month Status', ok: !!ms },
          { label: 'Month Locked', ok: !!locked },
          { label: 'Ready', ok: !!(xeroSynced && ms) },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${item.ok ? 'bg-green-500' : 'bg-zinc-300'}`} />
            <span className="text-xs text-zinc-600">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReportsClient({
  reports: initial, monthStatuses, availableMonths,
}: {
  reports: Report[];
  monthStatuses: MonthStatus[];
  availableMonths: AvailableMonth[];
}) {
  const router = useRouter();
  const [reports, setReports] = useState(initial);
  const [generating, setGenerating] = useState(false);

  const months = Array.from(new Set([
    ...availableMonths.map((m) => m.reportMonth.substring(0, 7)),
    ...reports.map((r) => r.reportMonth.substring(0, 7)),
  ])).sort().reverse();

  const prevMonth = (() => {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - 1);
    return d.toISOString().substring(0, 7);
  })();

  const [selectedMonth, setSelectedMonth] = useState(months[0] ?? prevMonth);

  async function handleGenerate() {
    setGenerating(true);
    const res = await fetch('/api/finance/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportMonth: selectedMonth + '-01' }),
    });
    if (res.ok) {
      const report = await res.json();
      router.push(`/finance/reports/${report.id}`);
    } else {
      const err = await res.json();
      alert(err.error ?? 'Failed to generate report');
    }
    setGenerating(false);
  }

  async function handleRegenerate(id: string) {
    if (!confirm('Regenerate calculations for this report? This will overwrite WIP data but preserve commentary.')) return;
    const res = await fetch(`/api/finance/reports/${id}`, { method: 'POST' });
    if (res.ok) {
      router.refresh();
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Management Reports</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Generate and manage monthly management reports.</p>
        </div>
      </div>

      {/* Generate new report */}
      <div className="bg-white border border-zinc-200 rounded-xl p-6 mb-8">
        <h2 className="text-base font-semibold text-zinc-900 mb-4">Generate Report</h2>
        <DataReadinessPanel month={selectedMonth} monthStatuses={monthStatuses} />
        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-700 focus:outline-none"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {new Date(m + '-01').toLocaleDateString('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
              </option>
            ))}
          </select>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-5 py-2 bg-brand hover:bg-brand/90 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            {generating ? 'Generating…' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* Existing reports */}
      <h2 className="text-base font-semibold text-zinc-900 mb-3">All Reports</h2>
      {reports.length === 0 ? (
        <div className="text-center py-12 text-zinc-400 text-sm">No reports yet. Generate your first report above.</div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Month</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Prepared By</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Generated</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-900">{fmtMonth(r.reportMonth)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOURS[r.status]}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{r.preparedBy.firstName} {r.preparedBy.lastName}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{fmtDate(r.generatedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {r.status !== 'FINAL' && (
                        <button onClick={() => handleRegenerate(r.id)} className="text-xs text-zinc-400 hover:text-zinc-700">Regenerate</button>
                      )}
                      <button
                        onClick={() => router.push(`/finance/reports/${r.id}`)}
                        className="text-xs text-brand hover:underline font-medium"
                      >
                        Open
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
