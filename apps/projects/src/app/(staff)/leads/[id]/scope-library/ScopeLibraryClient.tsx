'use client';
import { useState, useTransition } from 'react';
import { showToast, ToastContainer } from '@/components/Toast';
import { createScopeLibraryItem, deleteScopeLibraryItem } from '../actions';

type ScopeItem = {
  id: string;
  description: string;
  unit: string | null;
  notes: string | null;
  isGlobal: boolean;
  tradeSection: { id: string; name: string; code: string | null } | null;
};

type TradeSection = { id: string; name: string; code: string | null };

export default function ScopeLibraryClient({
  estimateId,
  items,
  tradeSections,
}: {
  estimateId: string;
  items: ScopeItem[];
  tradeSections: TradeSection[];
}) {
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('ALL');

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await createScopeLibraryItem(fd);
      setShowAdd(false);
      showToast('Scope item added');
    });
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this scope item?')) return;
    startTransition(async () => {
      await deleteScopeLibraryItem(id);
      showToast('Item deleted');
    });
  }

  const filtered = items.filter((item) => {
    if (sectionFilter !== 'ALL' && item.tradeSection?.id !== sectionFilter) return false;
    if (search && !item.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="h-full overflow-auto bg-zinc-50 p-6">
      <ToastContainer />
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-800">Scope Library ({items.length} items)</h2>
          <button onClick={() => setShowAdd(true)} className="px-3 py-1.5 text-sm bg-brand text-white rounded-md hover:bg-brand/90">+ Add Item</button>
        </div>

        {showAdd && (
          <form onSubmit={handleAdd} className="bg-white border border-zinc-200 rounded-lg p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-zinc-700 mb-1">Description *</label>
                <input name="description" required className="w-full border border-zinc-200 rounded px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Trade Section</label>
                <select name="tradeSectionId" className="w-full border border-zinc-200 rounded px-2 py-1.5 text-sm">
                  <option value="">— None —</option>
                  {tradeSections.map((s) => <option key={s.id} value={s.id}>{s.code ? `${s.code} — ` : ''}{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Unit</label>
                <input name="unit" className="w-full border border-zinc-200 rounded px-3 py-1.5 text-sm" placeholder="m2, lm, item…" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-zinc-700 mb-1">Notes</label>
                <textarea name="notes" rows={2} className="w-full border border-zinc-200 rounded px-3 py-1.5 text-sm resize-none" />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" name="isGlobal" value="true" id="isGlobal" className="rounded" />
                <label htmlFor="isGlobal" className="text-sm text-zinc-700">Mark as global template</label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm border border-zinc-200 rounded">Cancel</button>
              <button type="submit" disabled={pending} className="px-3 py-1.5 text-sm bg-brand text-white rounded disabled:opacity-50">Add</button>
            </div>
          </form>
        )}

        {/* Filters */}
        <div className="flex gap-3">
          <input type="search" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="border border-zinc-200 rounded px-3 py-1.5 text-sm w-48" />
          <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} className="border border-zinc-200 rounded px-3 py-1.5 text-sm">
            <option value="ALL">All Sections</option>
            {tradeSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500">Description</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500">Section</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500">Unit</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500">Global</th>
                <th className="px-4 py-2.5 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-zinc-400">{items.length === 0 ? 'No scope items yet.' : 'No items match your filters.'}</td></tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <td className="px-4 py-2.5 text-zinc-800">{item.description}</td>
                    <td className="px-4 py-2.5 text-zinc-500 text-xs">{item.tradeSection ? `${item.tradeSection.code ? item.tradeSection.code + ' — ' : ''}${item.tradeSection.name}` : '—'}</td>
                    <td className="px-4 py-2.5 text-zinc-500 text-xs">{item.unit ?? '—'}</td>
                    <td className="px-4 py-2.5">{item.isGlobal && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Global</span>}</td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => handleDelete(item.id)} className="p-1 text-zinc-400 hover:text-red-600 rounded">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
