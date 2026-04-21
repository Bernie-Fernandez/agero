'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { showToast, ToastContainer } from '@/components/Toast';
import SlidePanel from '@/components/SlidePanel';
import { createContact } from './actions';

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  mobile: string | null;
  jobTitle: string | null;
  contactType: string | null;
  isActive: boolean;
  addressState: string | null;
  createdAt: Date;
  companyContacts: { company: { id: string; name: string } }[];
  contactOwner: { firstName: string; lastName: string } | null;
};

type Company = { id: string; name: string };

type Tab = { id: string; label: string; filters: Record<string, string>; locked?: boolean };

const DEFAULT_TABS: Tab[] = [
  { id: 'all', label: 'All contacts', filters: {}, locked: true },
  { id: 'bycompany', label: 'By company', filters: { hasCompany: '1' }, locked: true },
  { id: 'pms', label: 'Project managers', filters: { type: 'Project Manager' }, locked: true },
  { id: 'recent', label: 'Recent', filters: { recent: '1' }, locked: true },
];

const ALL_COLUMNS = [
  { key: 'name', label: 'Name', always: true },
  { key: 'company', label: 'Company' },
  { key: 'jobTitle', label: 'Job Title' },
  { key: 'type', label: 'Type' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'state', label: 'State' },
  { key: 'status', label: 'Status' },
];

const DEFAULT_VISIBLE = ['name', 'company', 'jobTitle', 'type', 'phone', 'email', 'state', 'status'];
const STORAGE_COLS = 'agero_columns_contacts';
const STORAGE_TABS = 'agero_tabs_contacts';

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

export default function ContactsListClient({ initialContacts, companies }: { initialContacts: Contact[]; companies: Company[] }) {
  const [contacts] = useState(initialContacts);
  const [activeTabId, setActiveTabId] = useState('all');
  const [tabs, setTabs] = useState<Tab[]>(DEFAULT_TABS);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(DEFAULT_VISIBLE));
  const [searchQ, setSearchQ] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterState, setFilterState] = useState('');
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
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const filtered = contacts.filter((c) => {
    if (tf.hasCompany === '1' && c.companyContacts.length === 0) return false;
    if (tf.type && c.contactType !== tf.type) return false;
    if (tf.recent === '1' && new Date(c.createdAt) < thirtyDaysAgo) return false;
    if (filterCompany && !c.companyContacts.some((cc) => cc.company.id === filterCompany)) return false;
    if (filterType && c.contactType !== filterType) return false;
    if (filterState && c.addressState !== filterState) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
      if (!fullName.includes(q) && !(c.email ?? '').toLowerCase().includes(q) && !(c.mobile ?? '').includes(q)) return false;
    }
    return true;
  });

  const tabCounts: Record<string, number> = {};
  tabs.forEach((tab) => {
    const f = tab.filters;
    tabCounts[tab.id] = contacts.filter((c) => {
      if (f.hasCompany === '1' && c.companyContacts.length === 0) return false;
      if (f.type && c.contactType !== f.type) return false;
      if (f.recent === '1' && new Date(c.createdAt) < thirtyDaysAgo) return false;
      return true;
    }).length;
  });

  const col = (key: string) => visibleCols.has(key) || ALL_COLUMNS.find((c) => c.key === key)?.always;

  const uniqueTypes = [...new Set(contacts.map((c) => c.contactType).filter(Boolean))] as string[];

  return (
    <div className="p-8">
      <ToastContainer />

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Contacts</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{filtered.length} of {contacts.length} contacts</p>
        </div>
        <div className="flex items-center gap-2">
          <ColumnsButton visible={visibleCols} onChange={setVisibleCols} />
          <button onClick={() => setAddOpen(true)} className="inline-flex items-center px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity">
            + Add Contact
          </button>
        </div>
      </div>

      {/* Preset tabs */}
      <div className="flex items-center gap-0 border-b border-zinc-200 mb-0 overflow-x-auto">
        {tabs.map((tab) => (
          <div key={tab.id} className="relative group flex items-center shrink-0">
            <button
              onClick={() => setActiveTabId(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${activeTabId === tab.id ? 'border-brand text-brand' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}
            >
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
        <button onClick={() => { const l = prompt('Tab name:'); if (l) setTabs((p) => [...p, { id: `c_${Date.now()}`, label: l, filters: {} }]); }}
          className="px-3 py-2.5 text-sm text-zinc-400 hover:text-zinc-700 border-b-2 border-transparent -mb-px shrink-0">+</button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 py-3 border-b border-zinc-100 mb-4">
        <div className="relative flex-1 min-w-40">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" /></svg>
          <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search name, email or mobile…"
            className="w-full pl-8 pr-3 py-1.5 border border-zinc-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} className="border border-zinc-200 rounded-md px-2 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">All Companies</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="border border-zinc-200 rounded-md px-2 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">All Types</option>
          {uniqueTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterState} onChange={(e) => setFilterState(e.target.value)} className="border border-zinc-200 rounded-md px-2 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">All States</option>
          {['ACT','NSW','NT','QLD','SA','TAS','VIC','WA'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-400"><p className="text-sm">No contacts found.</p></div>
      ) : (
        <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="px-4 py-2.5 w-8"><input type="checkbox" className="accent-brand" readOnly /></th>
                {col('name') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Name</th>}
                {col('company') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Company</th>}
                {col('jobTitle') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Job Title</th>}
                {col('type') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Type</th>}
                {col('phone') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Mobile</th>}
                {col('email') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Email</th>}
                {col('state') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">State</th>}
                {col('status') && <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Status</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((contact, idx) => {
                const primaryCompany = contact.companyContacts[0]?.company;
                return (
                  <tr key={contact.id} onClick={() => window.location.href = `/crm/contacts/${contact.id}`}
                    className={`${idx < filtered.length - 1 ? 'border-b border-zinc-100' : ''} hover:bg-zinc-50 transition-colors cursor-pointer ${!contact.isActive ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" className="accent-brand" /></td>
                    {col('name') && (
                      <td className="px-4 py-3">
                        <Link href={`/crm/contacts/${contact.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-zinc-900 hover:text-brand">
                          {contact.firstName} {contact.lastName}
                        </Link>
                      </td>
                    )}
                    {col('company') && (
                      <td className="px-4 py-3 text-xs">
                        {primaryCompany ? (
                          <Link href={`/crm/companies/${primaryCompany.id}`} onClick={(e) => e.stopPropagation()} className="text-brand hover:underline">
                            {primaryCompany.name}
                          </Link>
                        ) : <span className="text-zinc-400">—</span>}
                      </td>
                    )}
                    {col('jobTitle') && <td className="px-4 py-3 text-xs text-zinc-600">{contact.jobTitle || <span className="text-zinc-400">—</span>}</td>}
                    {col('type') && <td className="px-4 py-3 text-xs text-zinc-600">{contact.contactType || <span className="text-zinc-400">—</span>}</td>}
                    {col('phone') && <td className="px-4 py-3 text-xs text-zinc-600">{contact.mobile || <span className="text-zinc-400">—</span>}</td>}
                    {col('email') && <td className="px-4 py-3 text-xs text-zinc-600">{contact.email || <span className="text-zinc-400">—</span>}</td>}
                    {col('state') && <td className="px-4 py-3 text-xs text-zinc-600">{contact.addressState || <span className="text-zinc-400">—</span>}</td>}
                    {col('status') && (
                      <td className="px-4 py-3 text-xs">
                        <span className={`px-2 py-0.5 rounded-full font-medium ${contact.isActive ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                          {contact.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Contact slide-in */}
      <SlidePanel isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Contact">
        <form action={async (fd) => { await createContact(fd); setAddOpen(false); showToast('Contact created'); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">First Name <span className="text-red-500">*</span></label>
              <input name="firstName" required className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Last Name <span className="text-red-500">*</span></label>
              <input name="lastName" required className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Company</label>
            <select name="companyId" className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" defaultValue="">
              <option value="">— Select company —</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Email</label>
            <input name="email" type="email" className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Mobile</label>
            <input name="mobile" className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Job Title</label>
            <input name="jobTitle" className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:opacity-90">Create Contact</button>
            <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50">Cancel</button>
          </div>
        </form>
      </SlidePanel>
    </div>
  );
}
