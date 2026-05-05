'use client';
import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { showToast, ToastContainer } from '@/components/Toast';
import SlidePanel from '@/components/SlidePanel';
import { useColumnResize } from '@/hooks/useColumnResize';
import { ResizableTh } from '@/components/ResizableTh';
import { createLead } from './actions';

// ─── Types ───────────────────────────────────────────────────────────────────

type Estimate = {
  id: string;
  leadNumber: string;
  title: string;
  status: string;
  pipelineStage: number;
  targetGpPct: number | string;
  minGpPct: number | string;
  createdAt: Date | string;
  updatedAt: Date | string;
  client: { name: string } | null;
  createdBy: { firstName: string; lastName: string };
  _count: { lines: number };
};

type Company = { id: string; name: string };
type AppUser = { id: string; firstName: string; lastName: string };
type RevenueCode = { id: string; catCode: string; codeDescription: string };

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_COLUMNS = [
  { key: 'leadNumber', label: 'Lead No.', always: true },
  { key: 'title', label: 'Title', always: true },
  { key: 'client', label: 'Client' },
  { key: 'status', label: 'Stage' },
  { key: 'targetGp', label: 'Target GP%' },
  { key: 'lines', label: 'Lines' },
  { key: 'createdBy', label: 'Created By' },
  { key: 'createdAt', label: 'Created' },
];

const DEFAULT_VISIBLE = ['leadNumber', 'title', 'client', 'status', 'targetGp', 'createdBy', 'createdAt'];

const PIPELINE_STAGES: Record<number, string> = {
  3: 'Qualified',
  4: 'Submission',
  5: 'Awaiting Decision',
  6: 'Intent to Negotiate',
  7: 'Won',
  8: 'Lost',
  9: 'Withdrawn',
  10: 'Unsuccessful',
  11: 'Dead',
  12: 'Declined',
  13: 'Sub Withdrawn',
};

const PIPELINE_COLORS: Record<number, string> = {
  3: 'bg-blue-100 text-blue-700',
  4: 'bg-violet-100 text-violet-700',
  5: 'bg-amber-100 text-amber-700',
  6: 'bg-orange-100 text-orange-700',
  7: 'bg-green-100 text-green-700',
  8: 'bg-red-100 text-red-700',
  9: 'bg-zinc-100 text-zinc-600',
  10: 'bg-zinc-100 text-zinc-500',
  11: 'bg-zinc-200 text-zinc-500',
  12: 'bg-rose-100 text-rose-600',
  13: 'bg-zinc-100 text-zinc-500',
};

const JOB_TYPES = [
  'Commercial Fitout',
  'Refurbishment',
  'Make Good',
  'Design & Construct',
  'Minor Works',
  'Other',
];

// ─── New Lead Panel ──────────────────────────────────────────────────────────

function NewLeadPanel({
  open,
  onClose,
  clients,
  users,
  revenueCodes,
  currentUserId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  clients: Company[];
  users: AppUser[];
  revenueCodes: RevenueCode[];
  currentUserId: string;
  onCreated: (id: string) => void;
}) {
  const STAGE_CONFIDENCE: Record<number, number> = { 3:25,4:40,5:50,6:65,7:100,8:0,9:0,10:0,11:0,12:0,13:0 };
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<Company | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [stage, setStage] = useState(3);
  const [confidence, setConfidence] = useState(25);
  const [confidenceOverridden, setConfidenceOverridden] = useState(false);
  const filtered = clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 10);

  function validate(fd: FormData) {
    const e: Record<string, string> = {};
    if (!fd.get('title')) e.title = 'Required';
    if (!selectedClient) e.client = 'Select a client from CRM';
    if (!fd.get('addressStreet')) e.addressStreet = 'Required';
    if (!fd.get('addressSuburb')) e.addressSuburb = 'Required';
    if (!fd.get('addressState')) e.addressState = 'Required';
    if (!fd.get('addressPostcode')) e.addressPostcode = 'Required';
    if (!fd.get('jobType')) e.jobType = 'Required';
    if (!fd.get('estimatorId')) e.estimatorId = 'Required';
    if (!fd.get('revenueCostCodeId')) e.revenueCostCodeId = 'Required';
    return e;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (selectedClient) fd.set('clientId', selectedClient.id);
    const errs = validate(fd);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      const id = await createLead(fd);
      showToast('Lead created');
      onCreated(id as string);
    } catch {
      showToast('Failed to create lead', 'error');
      setSaving(false);
    }
  }

  const field = (key: string) => errors[key]
    ? 'w-full border border-red-400 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300'
    : 'w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30';

  return (
    <SlidePanel isOpen={open} onClose={onClose} title="New Lead">
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Project Name <span className="text-red-500">*</span></label>
          <input name="title" placeholder="e.g. Level 3 Fitout — 123 Collins St" className={field('title')} onChange={() => setErrors((p) => ({ ...p, title: '' }))} />
          {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
        </div>

        {/* Client */}
        <div className="relative">
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Client <span className="text-red-500">*</span>
            <a href="/crm/companies/new" target="_blank" className="ml-2 text-xs text-brand font-normal hover:underline">Add to CRM first</a>
          </label>
          <input
            type="text"
            placeholder="Search clients…"
            value={selectedClient ? selectedClient.name : query}
            onChange={(e) => { setQuery(e.target.value); setSelectedClient(null); setShowDropdown(true); setErrors((p) => ({ ...p, client: '' })); }}
            onFocus={() => setShowDropdown(true)}
            className={field('client')}
          />
          {showDropdown && filtered.length > 0 && !selectedClient && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-zinc-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
              {filtered.map((c) => (
                <button key={c.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50"
                  onMouseDown={() => { setSelectedClient(c); setShowDropdown(false); }}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
          {showDropdown && filtered.length === 0 && query && !selectedClient && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-zinc-200 rounded-md shadow-lg p-3 text-xs text-zinc-400">
              No clients found. <a href="/crm/companies/new" target="_blank" className="text-brand hover:underline">Add to CRM</a>
            </div>
          )}
          {selectedClient && (
            <button type="button" className="absolute right-3 top-8 text-zinc-400 hover:text-zinc-600 text-xs"
              onClick={() => { setSelectedClient(null); setQuery(''); }}>✕ clear</button>
          )}
          {errors.client && <p className="mt-1 text-xs text-red-500">{errors.client}</p>}
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Address <span className="text-red-500">*</span></label>
          <div className="space-y-2">
            <input name="addressStreet" placeholder="Street address" className={field('addressStreet')} onChange={() => setErrors((p) => ({ ...p, addressStreet: '' }))} />
            {errors.addressStreet && <p className="text-xs text-red-500">{errors.addressStreet}</p>}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <input name="addressSuburb" placeholder="Suburb" className={field('addressSuburb')} onChange={() => setErrors((p) => ({ ...p, addressSuburb: '' }))} />
                {errors.addressSuburb && <p className="text-xs text-red-500">{errors.addressSuburb}</p>}
              </div>
              <div>
                <select name="addressState" defaultValue="" className={field('addressState')} onChange={() => setErrors((p) => ({ ...p, addressState: '' }))}>
                  <option value="" disabled>State</option>
                  {['VIC','NSW','QLD','WA','SA','TAS','ACT','NT'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {errors.addressState && <p className="text-xs text-red-500">{errors.addressState}</p>}
              </div>
              <div>
                <input name="addressPostcode" placeholder="Postcode" maxLength={4} className={field('addressPostcode')} onChange={() => setErrors((p) => ({ ...p, addressPostcode: '' }))} />
                {errors.addressPostcode && <p className="text-xs text-red-500">{errors.addressPostcode}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Stage + Confidence */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Stage / Confidence</label>
          <div className="flex gap-2">
            <select
              name="pipelineStage"
              value={stage}
              onChange={(e) => {
                const s = Number(e.target.value);
                setStage(s);
                if (!confidenceOverridden) setConfidence(STAGE_CONFIDENCE[s] ?? 0);
              }}
              className="flex-1 border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              {Object.entries(PIPELINE_STAGES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <div className="flex items-center gap-1 w-28">
              <input
                name="confidencePct"
                type="number"
                min="0"
                max="100"
                value={confidence}
                onChange={(e) => { setConfidence(Number(e.target.value)); setConfidenceOverridden(true); }}
                className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
              <span className="text-zinc-400 text-sm shrink-0">%</span>
            </div>
          </div>
          <p className="mt-1 text-xs text-zinc-400">Confidence auto-fills by stage; override if needed.</p>
        </div>

        {/* Job Type */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Job Type <span className="text-red-500">*</span></label>
          <select name="jobType" defaultValue="" className={field('jobType')} onChange={() => setErrors((p) => ({ ...p, jobType: '' }))}>
            <option value="" disabled>Select job type</option>
            {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {errors.jobType && <p className="mt-1 text-xs text-red-500">{errors.jobType}</p>}
        </div>

        {/* Revenue Code */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Revenue Code <span className="text-red-500">*</span></label>
          <select name="revenueCostCodeId" defaultValue="" className={field('revenueCostCodeId')} onChange={() => setErrors((p) => ({ ...p, revenueCostCodeId: '' }))}>
            <option value="" disabled>Select revenue code</option>
            {revenueCodes.map((rc) => <option key={rc.id} value={rc.id}>{rc.catCode} — {rc.codeDescription}</option>)}
          </select>
          {errors.revenueCostCodeId && <p className="mt-1 text-xs text-red-500">{errors.revenueCostCodeId}</p>}
        </div>

        {/* Estimator */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Estimator <span className="text-red-500">*</span></label>
          <select name="estimatorId" defaultValue={currentUserId} className={field('estimatorId')} onChange={() => setErrors((p) => ({ ...p, estimatorId: '' }))}>
            {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
          </select>
          {errors.estimatorId && <p className="mt-1 text-xs text-red-500">{errors.estimatorId}</p>}
        </div>

        {/* Floor Area */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Floor Area (m²)</label>
          <input name="floorAreaM2" type="number" min="0" step="0.01" placeholder="e.g. 850"
            className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Lead Notes</label>
          <textarea name="notes" rows={3} placeholder="Brief description of the opportunity…"
            className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">Cancel</button>
          <button type="submit" disabled={saving}
            className="px-4 py-2 text-sm bg-brand text-white rounded-md hover:bg-brand/90 disabled:opacity-50">
            {saving ? 'Creating…' : 'Create Lead'}
          </button>
        </div>
      </form>
    </SlidePanel>
  );
}

// ─── Column Picker ────────────────────────────────────────────────────────────

function ColumnPicker({
  columns,
  visible,
  onChange,
}: {
  columns: typeof ALL_COLUMNS;
  visible: string[];
  onChange: (cols: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-zinc-200 rounded-md hover:bg-zinc-50 text-zinc-600"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M3 6h18M3 18h18" />
        </svg>
        Columns
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-white border border-zinc-200 rounded-md shadow-lg z-20 p-2 space-y-1">
          {columns.map((col) => (
            <label key={col.key} className="flex items-center gap-2 px-2 py-1 text-sm cursor-pointer hover:bg-zinc-50 rounded">
              <input
                type="checkbox"
                checked={visible.includes(col.key)}
                disabled={col.always}
                onChange={(e) => {
                  onChange(e.target.checked ? [...visible, col.key] : visible.filter((k) => k !== col.key));
                }}
                className="rounded"
              />
              {col.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LeadsListClient({
  initialLeads,
  clients,
  users,
  revenueCodes,
  currentUserId,
}: {
  initialLeads: Estimate[];
  clients: Company[];
  users: AppUser[];
  revenueCodes: RevenueCode[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [visibleCols, setVisibleCols] = useState<string[]>(DEFAULT_VISIBLE);
  const [panelOpen, setPanelOpen] = useState(false);
  const { widths: colWidths, startResize: handleResize } = useColumnResize(
    'agero_columns_leads',
    Object.fromEntries(ALL_COLUMNS.map((c) => [c.key, c.key === 'title' ? 280 : 120]))
  );

  const filtered = initialLeads.filter((e) => {
    if (stageFilter !== 'ALL' && e.pipelineStage !== Number(stageFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !e.leadNumber.toLowerCase().includes(q) &&
        !e.title.toLowerCase().includes(q) &&
        !(e.client?.name.toLowerCase().includes(q) ?? false)
      ) return false;
    }
    return true;
  });

  const handleCreated = useCallback((id: string) => {
    router.push(`/leads/${id}/dashboard`);
  }, [router]);

  return (
    <div className="flex flex-col h-[calc(100vh-48px)]">
      <ToastContainer />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-white">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Estimating Leads</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{filtered.length} of {initialLeads.length} leads</p>
        </div>
        <button
          onClick={() => setPanelOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm rounded-md hover:bg-brand/90"
        >
          <span>+</span> New Lead
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-100 bg-white">
        <input
          type="search"
          placeholder="Search leads…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56 border border-zinc-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="border border-zinc-200 rounded-md px-3 py-1.5 text-sm focus:outline-none"
        >
          <option value="ALL">All Stages</option>
          {Object.entries(PIPELINE_STAGES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <div className="ml-auto">
          <ColumnPicker columns={ALL_COLUMNS} visible={visibleCols} onChange={setVisibleCols} />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse min-w-[600px]">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-zinc-200">
              {ALL_COLUMNS.filter((c) => visibleCols.includes(c.key)).map((col) => (
                <ResizableTh
                  key={col.key}
                  col={col.key}
                  width={colWidths[col.key] ?? 120}
                  onStartResize={handleResize}
                  className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {col.label}
                </ResizableTh>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.length} className="px-4 py-12 text-center text-sm text-zinc-400">
                  {initialLeads.length === 0 ? 'No leads yet. Create your first lead to get started.' : 'No leads match your filters.'}
                </td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-zinc-100 hover:bg-zinc-50 cursor-pointer"
                  onClick={() => router.push(`/leads/${e.id}/dashboard`)}
                >
                  {visibleCols.includes('leadNumber') && (
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600 whitespace-nowrap">{e.leadNumber}</td>
                  )}
                  {visibleCols.includes('title') && (
                    <td className="px-4 py-3 font-medium text-zinc-900 max-w-[280px] truncate">{e.title}</td>
                  )}
                  {visibleCols.includes('client') && (
                    <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{e.client?.name ?? '—'}</td>
                  )}
                  {visibleCols.includes('status') && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PIPELINE_COLORS[e.pipelineStage] ?? 'bg-zinc-100 text-zinc-600'}`}>
                        {PIPELINE_STAGES[e.pipelineStage] ?? `Stage ${e.pipelineStage}`}
                      </span>
                    </td>
                  )}
                  {visibleCols.includes('targetGp') && (
                    <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{Number(e.targetGpPct).toFixed(2)}%</td>
                  )}
                  {visibleCols.includes('lines') && (
                    <td className="px-4 py-3 text-zinc-500 text-center">{e._count.lines}</td>
                  )}
                  {visibleCols.includes('createdBy') && (
                    <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{e.createdBy.firstName} {e.createdBy.lastName}</td>
                  )}
                  {visibleCols.includes('createdAt') && (
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap text-xs">
                      {new Date(e.createdAt).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <NewLeadPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        clients={clients}
        users={users}
        revenueCodes={revenueCodes}
        currentUserId={currentUserId}
        onCreated={handleCreated}
      />
    </div>
  );
}
