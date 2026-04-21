'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { patchCompanyField } from './actions';
import { showToast, ToastContainer } from '@/components/Toast';
import dynamic from 'next/dynamic';

const AddCompanyWizard = dynamic(
  () => import('@/components/AddCompanyWizard').then((m) => ({ default: m.AddCompanyWizard })),
  { ssr: false }
);

// ─── Types ─────────────────────────────────────────────────────────────────

type Company = {
  id: string;
  name: string;
  legalName: string | null;
  types: string[];
  abn: string | null;
  abnStatus: string;
  paymentTerms: string | null;
  tier: string | null;
  performanceRating: string | null;
  isActive: boolean;
  isBlacklisted: boolean;
  isPreferred: boolean;
  addressState: string | null;
  _count: { companyContacts: number };
  insurancePolicies: { expiryDate: Date; policyType: { isMandatory: boolean } }[];
  trades: { costCode: { codeDescription: string } }[];
};

type PaymentTerm = { id: string; name: string };

type Tab = {
  id: string;
  label: string;
  filters: Record<string, string>;
  locked?: boolean;
};

// ─── Constants ─────────────────────────────────────────────────────────────

const DEFAULT_TABS: Tab[] = [
  { id: 'all', label: 'Master view', filters: {}, locked: true },
  { id: 'subs', label: 'Subcontractors', filters: { type: 'SUBCONTRACTOR' }, locked: true },
  { id: 'clients', label: 'Clients', filters: { type: 'CLIENT' }, locked: true },
  { id: 'suppliers', label: 'Suppliers', filters: { type: 'SUPPLIER' }, locked: true },
  { id: 'preferred', label: 'Preferred', filters: { preferred: '1' }, locked: true },
  { id: 'tier1', label: 'Tier 1', filters: { tier: 'TIER_1' }, locked: true },
];

const ALL_COLUMNS = [
  { key: 'name', label: 'Company Name', always: true },
  { key: 'types', label: 'Type' },
  { key: 'abn', label: 'ABN' },
  { key: 'state', label: 'State' },
  { key: 'paymentTerms', label: 'Payment Terms' },
  { key: 'performance', label: 'Performance' },
  { key: 'status', label: 'Status' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'tier', label: 'Tier' },
];

const DEFAULT_VISIBLE = ['name', 'types', 'abn', 'state', 'paymentTerms', 'performance', 'status'];

const STORAGE_COLS = 'agero_columns_companies';
const STORAGE_TABS = 'agero_tabs_companies';

// ─── Labels ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = { SUBCONTRACTOR: 'Subcontractor', CLIENT: 'Client', CONSULTANT: 'Consultant', SUPPLIER: 'Supplier' };
const TYPE_COLORS: Record<string, string> = { SUBCONTRACTOR: 'bg-orange-100 text-orange-700', CLIENT: 'bg-blue-100 text-blue-700', CONSULTANT: 'bg-purple-100 text-purple-700', SUPPLIER: 'bg-green-100 text-green-700' };
const TIER_LABELS: Record<string, string> = { TIER_1: 'T1', TIER_2: 'T2', TIER_3: 'T3' };
const TIER_COLORS: Record<string, string> = { TIER_1: 'bg-indigo-100 text-indigo-700', TIER_2: 'bg-sky-100 text-sky-700', TIER_3: 'bg-zinc-100 text-zinc-600' };
const PERF_LABELS: Record<string, string> = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low', UNTESTED: 'Untested' };
const PERF_COLORS: Record<string, string> = { HIGH: 'bg-green-100 text-green-700', MEDIUM: 'bg-yellow-100 text-yellow-700', LOW: 'bg-red-100 text-red-700', UNTESTED: 'bg-gray-100 text-gray-500' };

function formatAbn(abn: string) {
  const d = abn.replace(/\s/g, '');
  if (d.length !== 11) return abn;
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
}

// ─── Inline edit cell ───────────────────────────────────────────────────────

function InlineCell({
  value,
  companyId,
  field,
  renderDisplay,
  renderInput,
  onSaved,
}: {
  value: string;
  companyId: string;
  field: string;
  renderDisplay: (v: string) => React.ReactNode;
  renderInput: (v: string, onChange: (v: string) => void, onBlur: () => void) => React.ReactNode;
  onSaved: (id: string, field: string, value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    try {
      await patchCompanyField(companyId, field, draft);
      onSaved(companyId, field, draft);
      showToast('Saved');
    } catch {
      showToast('Save failed', 'error');
      setDraft(value);
    }
    setSaving(false);
    setEditing(false);
  }, [draft, value, companyId, field, onSaved]);

  if (editing) {
    return (
      <div onClick={(e) => e.stopPropagation()}>
        {renderInput(draft, setDraft, save)}
        {saving && <span className="text-xs text-zinc-400 ml-1">Saving…</span>}
      </div>
    );
  }

  return (
    <div
      className="cursor-pointer hover:bg-zinc-100 rounded px-1 -mx-1 inline-block"
      onClick={(e) => { e.stopPropagation(); setEditing(true); setDraft(value); }}
      title="Click to edit"
    >
      {renderDisplay(value)}
    </div>
  );
}

// ─── Columns button ─────────────────────────────────────────────────────────

function ColumnsButton({ visible, onChange }: { visible: Set<string>; onChange: (v: Set<string>) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        Columns
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg z-30 min-w-[160px] py-1">
          {ALL_COLUMNS.map((col) => (
            <label key={col.key} className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 cursor-pointer">
              <input
                type="checkbox"
                checked={visible.has(col.key) || !!col.always}
                disabled={!!col.always}
                onChange={(e) => {
                  const next = new Set(visible);
                  if (e.target.checked) next.add(col.key); else next.delete(col.key);
                  onChange(next);
                }}
                className="accent-brand"
              />
              {col.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Preset tabs bar ────────────────────────────────────────────────────────

function TabsBar({
  tabs,
  activeId,
  counts,
  onSelect,
  onAdd,
  onDelete,
}: {
  tabs: Tab[];
  activeId: string;
  counts: Record<string, number>;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-0 border-b border-zinc-200 mb-0 overflow-x-auto">
      {tabs.map((tab) => (
        <div key={tab.id} className="relative group flex items-center shrink-0">
          <button
            onClick={() => onSelect(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              activeId === tab.id
                ? 'border-brand text-brand'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300'
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${activeId === tab.id ? 'bg-brand/10 text-brand' : 'bg-zinc-100 text-zinc-500'}`}>
              {counts[tab.id] ?? 0}
            </span>
          </button>
          {!tab.locked && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(tab.id); }}
              className="absolute right-0.5 top-1 opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 text-xs px-1"
              title="Remove tab"
            >×</button>
          )}
        </div>
      ))}
      <button
        onClick={onAdd}
        className="px-3 py-2.5 text-sm text-zinc-400 hover:text-zinc-700 border-b-2 border-transparent -mb-px shrink-0"
        title="Add view"
      >+</button>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function CompaniesListClient({
  initialCompanies,
  paymentTermsById,
  paymentTermsList,
}: {
  initialCompanies: Company[];
  paymentTermsById: Record<string, string>;
  paymentTermsList: PaymentTerm[];
}) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [activeTabId, setActiveTabId] = useState('all');
  const [tabs, setTabs] = useState<Tab[]>(DEFAULT_TABS);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(DEFAULT_VISIBLE));
  const [searchQ, setSearchQ] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterTier, setFilterTier] = useState('');
  const [filterPerf, setFilterPerf] = useState('');
  const [filterState, setFilterState] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const savedCols = localStorage.getItem(STORAGE_COLS);
      if (savedCols) setVisibleCols(new Set(JSON.parse(savedCols)));
      const savedTabs = localStorage.getItem(STORAGE_TABS);
      if (savedTabs) setTabs(JSON.parse(savedTabs));
    } catch {}
    setHydrated(true);
  }, []);

  // Save columns to localStorage
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_COLS, JSON.stringify([...visibleCols]));
  }, [visibleCols, hydrated]);

  // Save tabs to localStorage
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_TABS, JSON.stringify(tabs));
  }, [tabs, hydrated]);

  // Filter data
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const tabFilters = activeTab?.filters ?? {};

  const today = new Date();

  const filtered = companies.filter((c) => {
    // Tab filters
    if (tabFilters.type && !c.types.includes(tabFilters.type)) return false;
    if (tabFilters.tier && c.tier !== tabFilters.tier) return false;
    if (tabFilters.preferred === '1' && !c.isPreferred) return false;
    // Dropdown filters
    if (filterType && !c.types.includes(filterType)) return false;
    if (filterTier && c.tier !== filterTier) return false;
    if (filterPerf && c.performanceRating !== filterPerf) return false;
    if (filterState && c.addressState !== filterState) return false;
    // Search
    if (searchQ) {
      const q = searchQ.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !(c.abn ?? '').includes(q) && !(c.legalName ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Tab counts
  const tabCounts: Record<string, number> = {};
  tabs.forEach((tab) => {
    tabCounts[tab.id] = companies.filter((c) => {
      if (tab.filters.type && !c.types.includes(tab.filters.type)) return false;
      if (tab.filters.tier && c.tier !== tab.filters.tier) return false;
      if (tab.filters.preferred === '1' && !c.isPreferred) return false;
      return true;
    }).length;
  });

  const handleSaved = useCallback((id: string, field: string, value: string) => {
    setCompanies((prev) => prev.map((c) => c.id === id ? { ...c, [field]: value } : c));
  }, []);

  const handleAddTab = () => {
    const label = prompt('Tab name:');
    if (!label) return;
    const newTab: Tab = { id: `custom_${Date.now()}`, label, filters: {} };
    setTabs((prev) => [...prev, newTab]);
  };

  const handleDeleteTab = (id: string) => {
    setTabs((prev) => prev.filter((t) => t.id !== id));
    if (activeTabId === id) setActiveTabId('all');
  };

  const col = (key: string) => visibleCols.has(key) || ALL_COLUMNS.find((c) => c.key === key)?.always;

  return (
    <div className="p-8">
      <ToastContainer />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Companies</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{filtered.length} of {companies.length} companies</p>
        </div>
        <div className="flex items-center gap-2">
          <ColumnsButton visible={visibleCols} onChange={(v) => { setVisibleCols(v); }} />
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity"
          >
            + Add Company
          </button>
        </div>
      </div>

      {/* Preset tabs */}
      <TabsBar
        tabs={tabs}
        activeId={activeTabId}
        counts={tabCounts}
        onSelect={setActiveTabId}
        onAdd={handleAddTab}
        onDelete={handleDeleteTab}
      />

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 py-3 border-b border-zinc-100 mb-4">
        <div className="relative flex-1 min-w-40">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" /></svg>
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search name or ABN…"
            className="w-full pl-8 pr-3 py-1.5 border border-zinc-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="border border-zinc-200 rounded-md px-2 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">All Types</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)} className="border border-zinc-200 rounded-md px-2 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">All Tiers</option>
          {Object.entries(TIER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filterPerf} onChange={(e) => setFilterPerf(e.target.value)} className="border border-zinc-200 rounded-md px-2 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">All Performance</option>
          {Object.entries(PERF_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filterState} onChange={(e) => setFilterState(e.target.value)} className="border border-zinc-200 rounded-md px-2 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">All States</option>
          {['ACT','NSW','NT','QLD','SA','TAS','VIC','WA'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {(searchQ || filterType || filterTier || filterPerf || filterState) && (
          <button onClick={() => { setSearchQ(''); setFilterType(''); setFilterTier(''); setFilterPerf(''); setFilterState(''); }} className="text-sm text-zinc-500 hover:text-zinc-800 px-2">
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <p className="text-sm">No companies found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs w-8">
                  <input type="checkbox" className="accent-brand" readOnly />
                </th>
                {col('name') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Company Name</th>}
                {col('types') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Type</th>}
                {col('abn') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">ABN</th>}
                {col('state') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">State</th>}
                {col('paymentTerms') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Payment Terms</th>}
                {col('performance') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Performance</th>}
                {col('status') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Status</th>}
                {col('contacts') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Contacts</th>}
                {col('tier') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Tier</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((company, idx) => {
                const mandatoryPolicies = company.insurancePolicies.filter((p) => p.policyType.isMandatory);
                const hasExpired = mandatoryPolicies.some((p) => new Date(p.expiryDate) < today);
                const hasExpiring = !hasExpired && mandatoryPolicies.some((p) => {
                  const d = Math.ceil((new Date(p.expiryDate).getTime() - today.getTime()) / 86400000);
                  return d <= 30;
                });

                return (
                  <tr
                    key={company.id}
                    onClick={() => window.location.href = `/crm/companies/${company.id}`}
                    className={`${idx < filtered.length - 1 ? 'border-b border-zinc-100' : ''} hover:bg-zinc-50 transition-colors cursor-pointer ${!company.isActive ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="accent-brand" />
                    </td>
                    {col('name') && (
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          {mandatoryPolicies.length > 0 && (
                            <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${hasExpired ? 'bg-red-500' : hasExpiring ? 'bg-amber-400' : 'bg-green-500'}`} />
                          )}
                          <div>
                            <Link href={`/crm/companies/${company.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-zinc-900 hover:text-brand">
                              {company.name}
                            </Link>
                            {company.legalName && company.legalName !== company.name && (
                              <p className="text-xs text-zinc-400 mt-0.5">{company.legalName}</p>
                            )}
                            {company.trades[0] && <p className="text-xs text-zinc-400 mt-0.5">{company.trades[0].costCode.codeDescription}</p>}
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {company.isBlacklisted && <span className="text-xs px-1.5 py-0.5 rounded font-semibold bg-red-600 text-white">BLACKLISTED</span>}
                              {company.isPreferred && <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-yellow-100 text-yellow-700">★ Preferred</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                    )}
                    {col('types') && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {company.types.map((t) => (
                            <span key={t} className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[t] ?? 'bg-gray-100 text-gray-600'}`}>
                              {TYPE_LABELS[t] ?? t}
                            </span>
                          ))}
                        </div>
                      </td>
                    )}
                    {col('abn') && (
                      <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                        {company.abn ? formatAbn(company.abn) : <span className="text-zinc-400">—</span>}
                      </td>
                    )}
                    {col('state') && (
                      <td className="px-4 py-3 text-xs text-zinc-600">{company.addressState || <span className="text-zinc-400">—</span>}</td>
                    )}
                    {col('paymentTerms') && (
                      <td className="px-4 py-3 text-xs" onClick={(e) => e.stopPropagation()}>
                        <InlineCell
                          value={company.paymentTerms ?? ''}
                          companyId={company.id}
                          field="paymentTerms"
                          onSaved={handleSaved}
                          renderDisplay={(v) => (
                            <span className="text-zinc-600">
                              {v ? (paymentTermsById[v] ?? v) : <span className="text-zinc-400">—</span>}
                            </span>
                          )}
                          renderInput={(v, onChange, onBlur) => (
                            <select
                              value={v}
                              onChange={(e) => onChange(e.target.value)}
                              onBlur={onBlur}
                              autoFocus
                              className="border border-zinc-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand"
                            >
                              <option value="">— None —</option>
                              {paymentTermsList.map((pt) => (
                                <option key={pt.id} value={pt.id}>{pt.name}</option>
                              ))}
                            </select>
                          )}
                        />
                      </td>
                    )}
                    {col('performance') && (
                      <td className="px-4 py-3 text-xs" onClick={(e) => e.stopPropagation()}>
                        <InlineCell
                          value={company.performanceRating ?? ''}
                          companyId={company.id}
                          field="performanceRating"
                          onSaved={handleSaved}
                          renderDisplay={(v) => v ? (
                            <span className={`px-2 py-0.5 rounded-full font-medium ${PERF_COLORS[v]}`}>{PERF_LABELS[v]}</span>
                          ) : <span className="text-zinc-400">—</span>}
                          renderInput={(v, onChange, onBlur) => (
                            <select value={v} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} autoFocus
                              className="border border-zinc-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand">
                              <option value="">— None —</option>
                              {Object.entries(PERF_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                            </select>
                          )}
                        />
                      </td>
                    )}
                    {col('status') && (
                      <td className="px-4 py-3 text-xs">
                        <span className={`px-2 py-0.5 rounded-full font-medium ${company.isActive ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                          {company.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    )}
                    {col('contacts') && (
                      <td className="px-4 py-3 text-xs text-zinc-600">{company._count.companyContacts}</td>
                    )}
                    {col('tier') && (
                      <td className="px-4 py-3 text-xs" onClick={(e) => e.stopPropagation()}>
                        <InlineCell
                          value={company.tier ?? ''}
                          companyId={company.id}
                          field="tier"
                          onSaved={handleSaved}
                          renderDisplay={(v) => v ? (
                            <span className={`px-2 py-0.5 rounded-full font-medium ${TIER_COLORS[v]}`}>{TIER_LABELS[v]}</span>
                          ) : <span className="text-zinc-400">—</span>}
                          renderInput={(v, onChange, onBlur) => (
                            <select value={v} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} autoFocus
                              className="border border-zinc-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand">
                              <option value="">— None —</option>
                              {Object.entries(TIER_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                            </select>
                          )}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {addOpen && (
        <AddCompanyWizard
          paymentTerms={paymentTermsList.map((pt) => ({ ...pt, isDefault: false }))}
        />
      )}
    </div>
  );
}
