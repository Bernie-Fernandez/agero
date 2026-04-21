'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ToastContainer } from '@/components/Toast';
import SlidePanel from '@/components/SlidePanel';
import { createProject } from './actions';
const PROJECT_STATUSES = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] as const;

type Project = {
  id: string;
  name: string;
  projectNumber: string | null;
  status: string;
  contractValue: { toString(): string } | null;
  siteAddress: string | null;
  startDate: Date | null;
  endDate: Date | null;
  client: { id: string; name: string } | null;
};

type Company = { id: string; name: string };
type Tab = { id: string; label: string; filters: Record<string, string>; locked?: boolean };

const DEFAULT_TABS: Tab[] = [
  { id: 'all', label: 'All projects', filters: {}, locked: true },
  { id: 'active', label: 'Active', filters: { status: 'ACTIVE' }, locked: true },
  { id: 'onhold', label: 'On hold', filters: { status: 'ON_HOLD' }, locked: true },
  { id: 'completed', label: 'Completed', filters: { status: 'COMPLETED' }, locked: true },
];

const ALL_COLUMNS = [
  { key: 'name', label: 'Project Name', always: true },
  { key: 'number', label: 'Number' },
  { key: 'client', label: 'Client' },
  { key: 'address', label: 'Address' },
  { key: 'status', label: 'Status' },
  { key: 'budget', label: 'Budget' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'endDate', label: 'End Date' },
];

const DEFAULT_VISIBLE = ['name', 'number', 'client', 'address', 'status', 'budget', 'startDate'];
const STORAGE_COLS = 'agero_columns_projects';
const STORAGE_TABS = 'agero_tabs_projects';

const STATUS_LABELS: Record<string, string> = {
  PRECONSTRUCTION: 'Pre-construction', ACTIVE: 'Active', PRACTICAL_COMPLETION: 'Practical Completion',
  ON_HOLD: 'On Hold', COMPLETED: 'Completed', DEFECTS: 'Defects', CLOSED: 'Closed',
};
const STATUS_COLORS: Record<string, string> = {
  PRECONSTRUCTION: 'bg-blue-100 text-blue-700', ACTIVE: 'bg-green-100 text-green-700',
  PRACTICAL_COMPLETION: 'bg-purple-100 text-purple-700', ON_HOLD: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-zinc-100 text-zinc-600', DEFECTS: 'bg-orange-100 text-orange-700', CLOSED: 'bg-zinc-100 text-zinc-500',
};

function formatDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatCurrency(v: { toString(): string } | null | undefined) {
  if (!v) return '—';
  return `$${Number(v.toString()).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function ColumnsButton({ visible, onChange }: { visible: Set<string>; onChange: (v: Set<string>) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        Columns
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg z-30 min-w-[160px] py-1">
          {ALL_COLUMNS.map((c) => (
            <label key={c.key} className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 cursor-pointer">
              <input type="checkbox" checked={visible.has(c.key) || !!c.always} disabled={!!c.always}
                onChange={(e) => { const n = new Set(visible); if (e.target.checked) n.add(c.key); else n.delete(c.key); onChange(n); }}
                className="accent-brand" />
              {c.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProjectsListClient({ initialProjects, companies }: { initialProjects: Project[]; companies: Company[] }) {
  const [projects] = useState(initialProjects);
  const [activeTabId, setActiveTabId] = useState('all');
  const [tabs, setTabs] = useState<Tab[]>(DEFAULT_TABS);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(DEFAULT_VISIBLE));
  const [searchQ, setSearchQ] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const c = localStorage.getItem(STORAGE_COLS);
      if (c) setVisibleCols(new Set(JSON.parse(c)));
      const t = localStorage.getItem(STORAGE_TABS);
      if (t) setTabs(JSON.parse(t));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => { if (hydrated) localStorage.setItem(STORAGE_COLS, JSON.stringify([...visibleCols])); }, [visibleCols, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem(STORAGE_TABS, JSON.stringify(tabs)); }, [tabs, hydrated]);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const tf = activeTab?.filters ?? {};

  const filtered = projects.filter((p) => {
    if (tf.status && p.status !== tf.status) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    if (filterClient && p.client?.id !== filterClient) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !(p.projectNumber ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const tabCounts: Record<string, number> = {};
  tabs.forEach((tab) => {
    tabCounts[tab.id] = projects.filter((p) => {
      if (tab.filters.status && p.status !== tab.filters.status) return false;
      return true;
    }).length;
  });

  const col = (key: string) => visibleCols.has(key) || ALL_COLUMNS.find((c) => c.key === key)?.always;

  const STATUS_OPTIONS = [...PROJECT_STATUSES];

  return (
    <div className="p-8">
      <ToastContainer />

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Projects</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{filtered.length} of {projects.length} projects</p>
        </div>
        <div className="flex items-center gap-2">
          <ColumnsButton visible={visibleCols} onChange={setVisibleCols} />
          <button onClick={() => setAddOpen(true)} className="inline-flex items-center px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity">
            + Add Project
          </button>
        </div>
      </div>

      {/* Preset tabs */}
      <div className="flex items-center gap-0 border-b border-zinc-200 mb-0 overflow-x-auto">
        {tabs.map((tab) => (
          <div key={tab.id} className="relative group flex items-center shrink-0">
            <button onClick={() => setActiveTabId(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${activeTabId === tab.id ? 'border-brand text-brand' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>
              {tab.label}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${activeTabId === tab.id ? 'bg-brand/10 text-brand' : 'bg-zinc-100 text-zinc-500'}`}>
                {tabCounts[tab.id] ?? 0}
              </span>
            </button>
            {!tab.locked && (
              <button onClick={() => { setTabs((p) => p.filter((t) => t.id !== tab.id)); if (activeTabId === tab.id) setActiveTabId('all'); }}
                className="absolute right-0.5 top-1 opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 text-xs px-1">×</button>
            )}
          </div>
        ))}
        <button onClick={() => { const l = prompt('Tab name:'); if (l) setTabs((p) => [...p, { id: `p_${Date.now()}`, label: l, filters: {} }]); }}
          className="px-3 py-2.5 text-sm text-zinc-400 hover:text-zinc-700 border-b-2 border-transparent -mb-px shrink-0">+</button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 py-3 border-b border-zinc-100 mb-4">
        <div className="relative flex-1 min-w-40">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" /></svg>
          <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search projects…"
            className="w-full pl-8 pr-3 py-1.5 border border-zinc-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border border-zinc-200 rounded-md px-2 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">All Status</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>)}
        </select>
        <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)} className="border border-zinc-200 rounded-md px-2 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">All Clients</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-400"><p className="text-sm">No projects found.</p></div>
      ) : (
        <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="px-4 py-2.5 w-8"><input type="checkbox" className="accent-brand" readOnly /></th>
                {col('name') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Project Name</th>}
                {col('number') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Number</th>}
                {col('client') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Client</th>}
                {col('address') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Address</th>}
                {col('status') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Status</th>}
                {col('budget') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Budget</th>}
                {col('startDate') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Start Date</th>}
                {col('endDate') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">End Date</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, idx) => (
                <tr key={p.id} onClick={() => window.location.href = `/projects/${p.id}`}
                  className={`${idx < filtered.length - 1 ? 'border-b border-zinc-100' : ''} hover:bg-zinc-50 transition-colors cursor-pointer`}>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" className="accent-brand" /></td>
                  {col('name') && (
                    <td className="px-4 py-3">
                      <Link href={`/projects/${p.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-zinc-900 hover:text-brand">
                        {p.name}
                      </Link>
                    </td>
                  )}
                  {col('number') && <td className="px-4 py-3 font-mono text-xs text-zinc-500">{p.projectNumber || <span className="text-zinc-400">—</span>}</td>}
                  {col('client') && <td className="px-4 py-3 text-xs text-zinc-600">{p.client?.name || <span className="text-zinc-400">—</span>}</td>}
                  {col('address') && <td className="px-4 py-3 text-xs text-zinc-500 max-w-[180px] truncate">{p.siteAddress || <span className="text-zinc-400">—</span>}</td>}
                  {col('status') && (
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </td>
                  )}
                  {col('budget') && <td className="px-4 py-3 text-xs text-zinc-600">{formatCurrency(p.contractValue)}</td>}
                  {col('startDate') && <td className="px-4 py-3 text-xs text-zinc-500">{formatDate(p.startDate)}</td>}
                  {col('endDate') && <td className="px-4 py-3 text-xs text-zinc-500">{formatDate(p.endDate)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Project slide-in */}
      <SlidePanel isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Project">
        <form action={async (fd) => { await createProject(fd); setAddOpen(false); }} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Project Name <span className="text-red-500">*</span></label>
            <input name="name" required placeholder="e.g. L16/350 Queen St"
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Project Number</label>
            <input name="projectNumber" placeholder="e.g. AG-2024-001"
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Client</label>
            <select name="clientId" defaultValue="" className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">— Select client —</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Site Address</label>
            <input name="siteAddress" className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Status</label>
            <select name="status" defaultValue="ACTIVE" className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Budget Total ($)</label>
            <input name="contractValue" type="number" step="0.01" min="0" placeholder="0.00"
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Start Date</label>
              <input name="startDate" type="date" className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">End Date</label>
              <input name="endDate" type="date" className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:opacity-90">Create Project</button>
            <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50">Cancel</button>
          </div>
        </form>
      </SlidePanel>
    </div>
  );
}
