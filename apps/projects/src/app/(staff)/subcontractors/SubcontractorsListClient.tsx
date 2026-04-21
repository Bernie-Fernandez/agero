'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ToastContainer } from '@/components/Toast';
import InvitePanel from './InvitePanel';

type Subcontractor = {
  id: string;
  name: string;
  abn: string | null;
  tier: string | null;
  performanceRating: string | null;
  isActive: boolean;
  addressState: string | null;
  subcontractorProfile: { approvalStatus: string; portalAccessEnabled: boolean } | null;
  trades: { costCode: { codeDescription: string } }[];
  insurancePolicies: { expiryDate: Date; policyType: { isMandatory: boolean } }[];
  _count: { companyContacts: number };
};

type Company = { id: string; name: string };

type Tab = { id: string; label: string; filters: Record<string, string>; locked?: boolean };

const DEFAULT_TABS: Tab[] = [
  { id: 'all', label: 'All', filters: {}, locked: true },
  { id: 'approved', label: 'Approved', filters: { approval: 'APPROVED' }, locked: true },
  { id: 'pending', label: 'Pending approval', filters: { approval: 'PENDING' }, locked: true },
  { id: 'suspended', label: 'Suspended', filters: { approval: 'SUSPENDED' }, locked: true },
  { id: 'portal', label: 'Portal active', filters: { portal: '1' }, locked: true },
];

const ALL_COLUMNS = [
  { key: 'name', label: 'Company', always: true },
  { key: 'abn', label: 'ABN' },
  { key: 'trades', label: 'Trades' },
  { key: 'tier', label: 'Tier' },
  { key: 'performance', label: 'Performance' },
  { key: 'approval', label: 'Approval Status' },
  { key: 'portal', label: 'Portal Access' },
  { key: 'state', label: 'State' },
];

const DEFAULT_VISIBLE = ['name', 'abn', 'trades', 'tier', 'performance', 'approval', 'portal'];
const STORAGE_COLS = 'agero_columns_subcontractors';
const STORAGE_TABS = 'agero_tabs_subcontractors';

const APPROVAL_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  SUSPENDED: 'bg-red-100 text-red-700',
  INACTIVE: 'bg-zinc-100 text-zinc-500',
};

const TIER_COLORS: Record<string, string> = { TIER_1: 'bg-indigo-100 text-indigo-700', TIER_2: 'bg-sky-100 text-sky-700', TIER_3: 'bg-zinc-100 text-zinc-600' };
const TIER_LABELS: Record<string, string> = { TIER_1: 'T1', TIER_2: 'T2', TIER_3: 'T3' };
const PERF_COLORS: Record<string, string> = { HIGH: 'bg-green-100 text-green-700', MEDIUM: 'bg-yellow-100 text-yellow-700', LOW: 'bg-red-100 text-red-700', UNTESTED: 'bg-gray-100 text-gray-500' };
const PERF_LABELS: Record<string, string> = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low', UNTESTED: 'Untested' };

function formatAbn(abn: string) {
  const d = abn.replace(/\s/g, '');
  if (d.length !== 11) return abn;
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
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

export default function SubcontractorsListClient({
  initialData,
  companies,
}: {
  initialData: Subcontractor[];
  companies: Company[];
}) {
  const [data] = useState(initialData);
  const [activeTabId, setActiveTabId] = useState('all');
  const [tabs, setTabs] = useState<Tab[]>(DEFAULT_TABS);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(DEFAULT_VISIBLE));
  const [searchQ, setSearchQ] = useState('');
  const [filterTier, setFilterTier] = useState('');
  const [filterApproval, setFilterApproval] = useState('');
  const [filterState, setFilterState] = useState('');
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
  const today = new Date();

  const filtered = data.filter((s) => {
    if (tf.approval && s.subcontractorProfile?.approvalStatus !== tf.approval) return false;
    if (tf.portal === '1' && !s.subcontractorProfile?.portalAccessEnabled) return false;
    if (filterTier && s.tier !== filterTier) return false;
    if (filterApproval && s.subcontractorProfile?.approvalStatus !== filterApproval) return false;
    if (filterState && s.addressState !== filterState) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !(s.abn ?? '').includes(q)) return false;
    }
    return true;
  });

  const tabCounts: Record<string, number> = {};
  tabs.forEach((tab) => {
    const f = tab.filters;
    tabCounts[tab.id] = data.filter((s) => {
      if (f.approval && s.subcontractorProfile?.approvalStatus !== f.approval) return false;
      if (f.portal === '1' && !s.subcontractorProfile?.portalAccessEnabled) return false;
      return true;
    }).length;
  });

  const col = (key: string) => visibleCols.has(key) || ALL_COLUMNS.find((c) => c.key === key)?.always;

  return (
    <div className="p-8">
      <ToastContainer />

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Subcontractors</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{filtered.length} of {data.length} subcontractors</p>
        </div>
        <div className="flex items-center gap-2">
          <ColumnsButton visible={visibleCols} onChange={setVisibleCols} />
          <InvitePanel companies={companies} />
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
        <button onClick={() => { const l = prompt('Tab name:'); if (l) setTabs((p) => [...p, { id: `s_${Date.now()}`, label: l, filters: {} }]); }}
          className="px-3 py-2.5 text-sm text-zinc-400 hover:text-zinc-700 border-b-2 border-transparent -mb-px shrink-0">+</button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 py-3 border-b border-zinc-100 mb-4">
        <div className="relative flex-1 min-w-40">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" /></svg>
          <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search company name or ABN…"
            className="w-full pl-8 pr-3 py-1.5 border border-zinc-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)} className="border border-zinc-200 rounded-md px-2 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">All Tiers</option>
          {Object.entries(TIER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filterApproval} onChange={(e) => setFilterApproval(e.target.value)} className="border border-zinc-200 rounded-md px-2 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">All Approval Status</option>
          {['PENDING','APPROVED','SUSPENDED','INACTIVE'].map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
        </select>
        <select value={filterState} onChange={(e) => setFilterState(e.target.value)} className="border border-zinc-200 rounded-md px-2 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">All States</option>
          {['ACT','NSW','NT','QLD','SA','TAS','VIC','WA'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-400"><p className="text-sm">No subcontractors found.</p></div>
      ) : (
        <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="px-4 py-2.5 w-8"><input type="checkbox" className="accent-brand" readOnly /></th>
                {col('name') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Company</th>}
                {col('abn') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">ABN</th>}
                {col('trades') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Trades</th>}
                {col('tier') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Tier</th>}
                {col('performance') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Performance</th>}
                {col('approval') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Approval</th>}
                {col('portal') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Portal</th>}
                {col('state') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">State</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, idx) => {
                const mandatoryPolicies = s.insurancePolicies.filter((p) => p.policyType.isMandatory);
                const hasExpired = mandatoryPolicies.some((p) => new Date(p.expiryDate) < today);

                return (
                  <tr key={s.id} onClick={() => window.location.href = `/crm/companies/${s.id}`}
                    className={`${idx < filtered.length - 1 ? 'border-b border-zinc-100' : ''} hover:bg-zinc-50 transition-colors cursor-pointer ${!s.isActive ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" className="accent-brand" /></td>
                    {col('name') && (
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          {mandatoryPolicies.length > 0 && (
                            <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${hasExpired ? 'bg-red-500' : 'bg-green-500'}`} />
                          )}
                          <Link href={`/crm/companies/${s.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-zinc-900 hover:text-brand">
                            {s.name}
                          </Link>
                        </div>
                      </td>
                    )}
                    {col('abn') && <td className="px-4 py-3 font-mono text-xs text-zinc-600">{s.abn ? formatAbn(s.abn) : <span className="text-zinc-400">—</span>}</td>}
                    {col('trades') && (
                      <td className="px-4 py-3 text-xs text-zinc-600">
                        {s.trades[0]?.costCode.codeDescription ?? <span className="text-zinc-400">—</span>}
                      </td>
                    )}
                    {col('tier') && (
                      <td className="px-4 py-3 text-xs">
                        {s.tier ? <span className={`px-2 py-0.5 rounded-full font-medium ${TIER_COLORS[s.tier]}`}>{TIER_LABELS[s.tier]}</span> : <span className="text-zinc-400">—</span>}
                      </td>
                    )}
                    {col('performance') && (
                      <td className="px-4 py-3 text-xs">
                        {s.performanceRating ? <span className={`px-2 py-0.5 rounded-full font-medium ${PERF_COLORS[s.performanceRating]}`}>{PERF_LABELS[s.performanceRating]}</span> : <span className="text-zinc-400">—</span>}
                      </td>
                    )}
                    {col('approval') && (
                      <td className="px-4 py-3 text-xs">
                        {s.subcontractorProfile ? (
                          <span className={`px-2 py-0.5 rounded-full font-medium ${APPROVAL_COLORS[s.subcontractorProfile.approvalStatus] ?? 'bg-zinc-100 text-zinc-500'}`}>
                            {s.subcontractorProfile.approvalStatus.charAt(0) + s.subcontractorProfile.approvalStatus.slice(1).toLowerCase()}
                          </span>
                        ) : <span className="text-zinc-400">—</span>}
                      </td>
                    )}
                    {col('portal') && (
                      <td className="px-4 py-3 text-xs">
                        {s.subcontractorProfile?.portalAccessEnabled ? (
                          <span className="px-2 py-0.5 rounded-full bg-brand/10 text-brand font-medium">Active</span>
                        ) : <span className="text-zinc-400">Not invited</span>}
                      </td>
                    )}
                    {col('state') && <td className="px-4 py-3 text-xs text-zinc-600">{s.addressState || <span className="text-zinc-400">—</span>}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
