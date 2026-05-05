'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

type FinanceProject = {
  id: string;
  reportMonth: string;
  jobNumber: string;
  projectName: string;
  status: 'AWARDED' | 'BACKLOG' | 'DLP' | 'CLOSED';
  forecastContractValue: string;
  forecastMarginPercent: string;
  claimTotal: string;
  claimRetention: string;
  totalCost: string;
  wip: string;
  dataVerified: boolean;
  updatedAt: string;
  forecastFinalCosts: string;
  riskAndOpportunity: string;
  forecastMarginDollars: string;
  targetExitMarginPercent: string | null;
  subClaims: string;
  subRetention: string;
  creditors: string;
  labour: string;
  notes: string | null;
  practicalCompletionDate: string | null;
};

type MonthStatus = { reportMonth: string; status: string };

const STATUS_COLOURS: Record<string, string> = {
  AWARDED: 'bg-green-100 text-green-700',
  BACKLOG: 'bg-blue-100 text-blue-700',
  DLP: 'bg-amber-100 text-amber-700',
  CLOSED: 'bg-zinc-100 text-zinc-500',
};

type ProjectStatus = 'AWARDED' | 'BACKLOG' | 'DLP' | 'CLOSED';

const EMPTY_FORM = {
  jobNumber: '', projectName: '', status: 'AWARDED' as ProjectStatus,
  practicalCompletionDate: '',
  forecastContractValue: '', forecastFinalCosts: '', riskAndOpportunity: '0',
  targetExitMarginPercent: '',
  claimTotal: '', claimRetention: '', subClaims: '', subRetention: '',
  creditors: '', labour: '', notes: '',
};

type FormData = Omit<typeof EMPTY_FORM, 'status'> & { status: ProjectStatus };

function fmt(n: string | number) {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(v)) return '—';
  return v.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
}
function fmtPct(n: string | number) {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(v)) return '—';
  return (v * 100).toFixed(1) + '%';
}
function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function calcDerived(f: FormData) {
  const cv = parseFloat(f.forecastContractValue) || 0;
  const fc = parseFloat(f.forecastFinalCosts) || 0;
  const ro = parseFloat(f.riskAndOpportunity) || 0;
  const marginDollars = cv - fc + ro;
  const marginPct = cv !== 0 ? marginDollars / cv : 0;
  const sc = parseFloat(f.subClaims) || 0;
  const cr = parseFloat(f.creditors) || 0;
  const lab = parseFloat(f.labour) || 0;
  const totalCost = sc + cr + lab;
  const ct = parseFloat(f.claimTotal) || 0;
  const wip = ct - totalCost;
  return { marginDollars, marginPct, totalCost, wip };
}

export default function FinanceProjectsClient({
  projects: initial, monthStatuses, defaultMonth, organisationId,
}: {
  projects: FinanceProject[];
  monthStatuses: MonthStatus[];
  defaultMonth: string;
  organisationId: string;
}) {
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [projects, setProjects] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showCsv, setShowCsv] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvResult, setCsvResult] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const filtered = useMemo(() =>
    projects.filter((p) => p.reportMonth.startsWith(selectedMonth.substring(0, 7))),
    [projects, selectedMonth]
  );

  const derived = useMemo(() => calcDerived(form), [form]);

  function openAdd() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(p: FinanceProject) {
    setEditId(p.id);
    setForm({
      jobNumber: p.jobNumber,
      projectName: p.projectName,
      status: p.status,
      practicalCompletionDate: p.practicalCompletionDate?.split('T')[0] ?? '',
      forecastContractValue: p.forecastContractValue,
      forecastFinalCosts: p.forecastFinalCosts,
      riskAndOpportunity: p.riskAndOpportunity,
      targetExitMarginPercent: p.targetExitMarginPercent ? (parseFloat(p.targetExitMarginPercent) * 100).toString() : '',
      claimTotal: p.claimTotal,
      claimRetention: p.claimRetention,
      subClaims: p.subClaims,
      subRetention: p.subRetention,
      creditors: p.creditors,
      labour: p.labour,
      notes: p.notes ?? '',
    });
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      ...form,
      reportMonth: selectedMonth,
      targetExitMarginPercent: form.targetExitMarginPercent ? (parseFloat(form.targetExitMarginPercent) / 100).toString() : null,
      forecastMarginDollars: derived.marginDollars.toFixed(2),
      forecastMarginPercent: derived.marginPct.toFixed(6),
      totalCost: derived.totalCost.toFixed(2),
      wip: derived.wip.toFixed(2),
    };
    const url = editId ? `/api/finance/projects/${editId}` : '/api/finance/projects';
    const method = editId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const updated = await res.json();
      if (editId) {
        setProjects((prev) => prev.map((p) => p.id === editId ? updated : p));
      } else {
        setProjects((prev) => [updated, ...prev]);
      }
      setShowForm(false);
      router.refresh();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/finance/projects/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== id));
    }
    setDeleteId(null);
  }

  async function handleCsvUpload() {
    if (!csvFile) return;
    setUploading(true);
    setCsvResult(null);
    const fd = new FormData();
    fd.append('file', csvFile);
    fd.append('reportMonth', selectedMonth);
    const res = await fetch('/api/finance/projects/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (res.ok) {
      setCsvResult(`Import complete: ${data.created} created, ${data.updated} updated, ${data.errors} errors.`);
      router.refresh();
    } else {
      setCsvResult(`Error: ${data.error}`);
    }
    setUploading(false);
  }

  const months = useMemo(() => {
    const set = new Set<string>();
    monthStatuses.forEach((m) => set.add(m.reportMonth.substring(0, 10)));
    projects.forEach((p) => set.add(p.reportMonth.substring(0, 10)));
    set.add(defaultMonth);
    return Array.from(set).sort().reverse();
  }, [monthStatuses, projects, defaultMonth]);

  function field(label: string, name: keyof FormData, type = 'text', hint?: string) {
    return (
      <div>
        <label className="block text-xs font-medium text-zinc-600 mb-1">{label}</label>
        {hint && <p className="text-xs text-zinc-400 mb-1">{hint}</p>}
        <input
          type={type}
          value={form[name] as string}
          onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
          className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Finance Projects</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Enter CatCloud project financial data per month.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-700 focus:outline-none"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {new Date(m).toLocaleDateString('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
              </option>
            ))}
          </select>
          <button onClick={() => setShowCsv(true)} className="px-3 py-2 border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-sm rounded-lg">Upload CSV</button>
          <button onClick={openAdd} className="px-4 py-2 bg-brand hover:bg-brand/90 text-white text-sm font-medium rounded-lg">Add Project</button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Job No</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Project</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Contract Value</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Margin %</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Claim Total</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Retention</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">WIP</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Updated</th>
              <th className="text-right px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-sm text-zinc-400">
                  No projects for this month. Click <strong>Add Project</strong> to get started.
                </td>
              </tr>
            ) : filtered.map((p) => (
              <tr key={p.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-mono text-xs text-zinc-600">{p.jobNumber}</td>
                <td className="px-4 py-3 font-medium text-zinc-900">{p.projectName}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOURS[p.status]}`}>{p.status}</span>
                </td>
                <td className="px-4 py-3 text-right text-zinc-700">{fmt(p.forecastContractValue)}</td>
                <td className="px-4 py-3 text-right text-zinc-700">{fmtPct(p.forecastMarginPercent)}</td>
                <td className="px-4 py-3 text-right text-zinc-700">{fmt(p.claimTotal)}</td>
                <td className="px-4 py-3 text-right text-zinc-700">{fmt(p.claimRetention)}</td>
                <td className="px-4 py-3 text-right text-zinc-700">{fmt(p.wip)}</td>
                <td className="px-4 py-3 text-zinc-500 text-xs">{fmtDate(p.updatedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => openEdit(p)} className="text-xs text-brand hover:underline">Edit</button>
                    <button onClick={() => setDeleteId(p.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Project Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h2 className="text-base font-semibold text-zinc-900">{editId ? 'Edit Project' : 'Add Project'}</h2>
              <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-zinc-700">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-6">
              {/* Project Identity */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Project Identity</h3>
                <div className="grid grid-cols-2 gap-4">
                  {field('Job Number', 'jobNumber')}
                  {field('Project Name', 'projectName')}
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ProjectStatus }))}
                      className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    >
                      {['AWARDED', 'BACKLOG', 'DLP', 'CLOSED'].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  {field('Practical Completion Date', 'practicalCompletionDate', 'date')}
                </div>
              </div>

              {/* Revenue & Margin */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Revenue & Margin</h3>
                <div className="grid grid-cols-2 gap-4">
                  {field('Forecast Contract Value ($)', 'forecastContractValue', 'number')}
                  {field('Forecast Final Costs ($)', 'forecastFinalCosts', 'number')}
                  {field('Risk & Opportunity Adjustment ($)', 'riskAndOpportunity', 'number', 'Enter negative value for risk')}
                  {field('Target Exit Margin % (from cost plan)', 'targetExitMarginPercent', 'number')}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-4 bg-zinc-50 rounded-lg p-3 text-sm">
                  <div><span className="text-zinc-500">Forecast Margin $:</span> <span className="font-semibold">{fmt(derived.marginDollars)}</span></div>
                  <div><span className="text-zinc-500">Forecast Margin %:</span> <span className="font-semibold">{(derived.marginPct * 100).toFixed(1)}%</span></div>
                </div>
              </div>

              {/* Cost Detail */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Cost Detail</h3>
                <div className="grid grid-cols-2 gap-4">
                  {field('Claim Total ($)', 'claimTotal', 'number')}
                  {field('Claim Retention ($, enter negative)', 'claimRetention', 'number')}
                  {field('Sub Claims ($)', 'subClaims', 'number')}
                  {field('Sub Retention ($, enter negative)', 'subRetention', 'number')}
                  {field('Creditors ($)', 'creditors', 'number')}
                  {field('Labour ($)', 'labour', 'number')}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-4 bg-zinc-50 rounded-lg p-3 text-sm">
                  <div><span className="text-zinc-500">Total Cost:</span> <span className="font-semibold">{fmt(derived.totalCost)}</span></div>
                  <div><span className="text-zinc-500">WIP:</span> <span className="font-semibold">{fmt(derived.wip)}</span></div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-zinc-100 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-brand hover:bg-brand/90 text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {saving ? 'Saving…' : (editId ? 'Update' : 'Add Project')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-zinc-900 mb-2">Delete Project?</h2>
            <p className="text-sm text-zinc-500 mb-6">This will soft-delete the project record. It cannot be recovered.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-zinc-600">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Upload */}
      {showCsv && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-base font-semibold text-zinc-900 mb-2">Upload CSV / Excel</h2>
            <p className="text-sm text-zinc-500 mb-4">
              Upload a CatCloud export (.csv or .xlsx). The system will map columns automatically for standard CatCloud exports.
            </p>
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-zinc-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200"
            />
            {csvResult && (
              <div className={`mt-3 px-3 py-2 rounded-lg text-sm ${csvResult.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {csvResult}
              </div>
            )}
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => { setShowCsv(false); setCsvResult(null); setCsvFile(null); }} className="px-4 py-2 text-sm text-zinc-600">Close</button>
              <button
                onClick={handleCsvUpload}
                disabled={!csvFile || uploading}
                className="px-4 py-2 bg-brand hover:bg-brand/90 text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {uploading ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
