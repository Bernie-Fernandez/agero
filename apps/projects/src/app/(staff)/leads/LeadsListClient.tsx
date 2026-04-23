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
  targetGpPct: number | string;
  minGpPct: number | string;
  createdAt: Date | string;
  updatedAt: Date | string;
  client: { name: string } | null;
  createdBy: { firstName: string; lastName: string };
  _count: { lines: number };
};

type Company = { id: string; name: string };

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_COLUMNS = [
  { key: 'leadNumber', label: 'Lead No.', always: true },
  { key: 'title', label: 'Title', always: true },
  { key: 'client', label: 'Client' },
  { key: 'status', label: 'Status' },
  { key: 'targetGp', label: 'Target GP%' },
  { key: 'lines', label: 'Lines' },
  { key: 'createdBy', label: 'Created By' },
  { key: 'createdAt', label: 'Created' },
];

const DEFAULT_VISIBLE = ['leadNumber', 'title', 'client', 'status', 'targetGp', 'createdBy', 'createdAt'];

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  CONVERTED: 'Converted',
  ARCHIVED: 'Archived',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-600',
  ACTIVE: 'bg-blue-100 text-blue-700',
  CONVERTED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-amber-100 text-amber-700',
};

// ─── New Lead Panel ──────────────────────────────────────────────────────────

function NewLeadPanel({
  open,
  onClose,
  clients,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  clients: Company[];
  onCreated: (id: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<Company | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const filtered = clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 10);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData(e.currentTarget);
      if (selectedClient) fd.set('clientId', selectedClient.id);
      const id = await createLead(fd);
      showToast('Lead created');
      onCreated(id as string);
    } catch {
      showToast('Failed to create lead', 'error');
      setSaving(false);
    }
  }

  return (
    <SlidePanel isOpen={open} onClose={onClose} title="New Lead">
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Title <span className="text-red-500">*</span></label>
          <input
            name="title"
            required
            placeholder="e.g. Level 3 Fitout — 123 Collins St"
            className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>

        <div className="relative">
          <label className="block text-sm font-medium text-zinc-700 mb-1">Client</label>
          <input
            type="text"
            placeholder="Search clients…"
            value={selectedClient ? selectedClient.name : query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedClient(null);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          {showDropdown && filtered.length > 0 && !selectedClient && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-zinc-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50"
                  onMouseDown={() => { setSelectedClient(c); setShowDropdown(false); }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          {selectedClient && (
            <button type="button" className="absolute right-3 top-8 text-zinc-400 hover:text-zinc-600 text-xs" onClick={() => { setSelectedClient(null); setQuery(''); }}>
              ✕ clear
            </button>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Notes</label>
          <textarea
            name="notes"
            rows={3}
            placeholder="Brief description of the opportunity…"
            className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">Cancel</button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm bg-brand text-white rounded-md hover:bg-brand/90 disabled:opacity-50"
          >
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
}: {
  initialLeads: Estimate[];
  clients: Company[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [visibleCols, setVisibleCols] = useState<string[]>(DEFAULT_VISIBLE);
  const [panelOpen, setPanelOpen] = useState(false);
  const { widths: colWidths, startResize: handleResize } = useColumnResize(
    'agero_columns_leads',
    Object.fromEntries(ALL_COLUMNS.map((c) => [c.key, c.key === 'title' ? 280 : 120]))
  );

  const filtered = initialLeads.filter((e) => {
    if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
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
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-zinc-200 rounded-md px-3 py-1.5 text-sm focus:outline-none"
        >
          <option value="ALL">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
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
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[e.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                        {STATUS_LABELS[e.status] ?? e.status}
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
        onCreated={handleCreated}
      />
    </div>
  );
}
