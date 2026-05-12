'use client';
import { useState, useTransition } from 'react';
import { updateReferenceItem, createReferenceItem, generateBluebeamTemplate } from './actions';
import SlidePanel from '@/components/SlidePanel';

type Item = {
  id: string;
  ageroRef: string;
  displayName: string;
  tradeSectionCode: string;
  tradeGroupColour: string;
  unit: string;
  natspecRef: string | null;
  asRef: string | null;
  isActive: boolean;
  standardRate: number | null;
};

const TRADE_GROUPS = [
  { code: 'ALL', label: 'All' },
  { code: 'DE', label: 'Demolition' },
  { code: 'PA', label: 'Partitions' },
  { code: 'FL', label: 'Flooring' },
  { code: 'ED', label: 'Electrical' },
  { code: 'PT', label: 'Painting' },
  { code: 'ME', label: 'Mechanical' },
  { code: 'PH', label: 'Hydraulic' },
  { code: 'FI', label: 'Fire' },
  { code: 'JO', label: 'Joinery' },
  { code: 'FU', label: 'Furniture' },
  { code: 'SI', label: 'Signage' },
  { code: 'CP', label: 'Preliminaries' },
];

const UNITS = ['LM', 'm2', 'EA', 'LS', 'WKS', 'm3', 'HR', 'KG'];
const TOOL_TYPES = ['polyline', 'polygon', 'count', 'rectangle'];

export default function ReferenceLibraryClient({
  items,
  organisationId,
}: {
  items: Item[];
  organisationId: string;
}) {
  const [activeTab, setActiveTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Item>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [downloading, setDownloading] = useState(false);

  const filtered = items.filter((item) => {
    const matchTab = activeTab === 'ALL' || item.tradeSectionCode === activeTab;
    const matchSearch =
      !search ||
      item.displayName.toLowerCase().includes(search.toLowerCase()) ||
      item.ageroRef.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  function startEdit(item: Item) {
    setEditingId(item.id);
    setEditValues({ displayName: item.displayName, unit: item.unit, natspecRef: item.natspecRef, asRef: item.asRef });
  }

  function saveEdit(id: string) {
    startTransition(async () => {
      await updateReferenceItem(id, {
        displayName: editValues.displayName,
        unit: editValues.unit,
        natspecRef: editValues.natspecRef ?? undefined,
        asRef: editValues.asRef ?? undefined,
      });
      setEditingId(null);
    });
  }

  async function handleDownloadBtx() {
    setDownloading(true);
    try {
      const xml = await generateBluebeamTemplate(organisationId);
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'agero-reference-library.btx';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Reference Library</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{items.length} measurement codes — {items.filter((i) => i.isActive).length} active</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadBtx}
            disabled={downloading}
            className="inline-flex items-center px-3 py-2 text-sm border border-zinc-200 rounded-md bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            {downloading ? 'Generating...' : 'Download Bluebeam Template (.btx)'}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
          >
            + Add Item
          </button>
        </div>
      </div>

      {/* Search + tabs */}
      <div className="mb-4">
        <input
          type="search"
          placeholder="Search by name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-3 py-2 text-sm border border-zinc-200 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-1 flex-wrap">
          {TRADE_GROUPS.map((g) => (
            <button
              key={g.code}
              onClick={() => setActiveTab(g.code)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeTab === g.code
                  ? 'bg-zinc-900 text-white'
                  : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs w-8"></th>
              <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Agero Ref</th>
              <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Display Name</th>
              <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Unit</th>
              <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Trade</th>
              <th className="text-right px-4 py-2.5 font-medium text-zinc-500 text-xs">Std Rate</th>
              <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">NatSpec</th>
              <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">AS Ref</th>
              <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Active</th>
              <th className="px-4 py-2.5 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-sm text-zinc-400">
                  No items found.
                </td>
              </tr>
            ) : (
              filtered.map((item, idx) => (
                <tr
                  key={item.id}
                  className={`${idx < filtered.length - 1 ? 'border-b border-zinc-100' : ''} ${!item.isActive ? 'opacity-50' : ''} hover:bg-zinc-50 transition-colors`}
                >
                  {/* Colour swatch */}
                  <td className="px-4 py-2.5">
                    <div className="w-4 h-4 rounded border border-zinc-200" style={{ backgroundColor: item.tradeGroupColour }} />
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-zinc-600">{item.ageroRef}</td>

                  {/* Editable: display name */}
                  <td className="px-4 py-2.5">
                    {editingId === item.id ? (
                      <input
                        className="w-full px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none"
                        value={editValues.displayName ?? ''}
                        onChange={(e) => setEditValues((v) => ({ ...v, displayName: e.target.value }))}
                      />
                    ) : (
                      <span className="text-zinc-800">{item.displayName}</span>
                    )}
                  </td>

                  {/* Editable: unit */}
                  <td className="px-4 py-2.5">
                    {editingId === item.id ? (
                      <select
                        className="px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none"
                        value={editValues.unit ?? ''}
                        onChange={(e) => setEditValues((v) => ({ ...v, unit: e.target.value }))}
                      >
                        {UNITS.map((u) => <option key={u}>{u}</option>)}
                      </select>
                    ) : (
                      <span className="font-mono text-xs text-zinc-600">{item.unit}</span>
                    )}
                  </td>

                  <td className="px-4 py-2.5">
                    <span className="text-xs text-zinc-500">{item.tradeSectionCode}</span>
                  </td>

                  <td className="px-4 py-2.5 text-right font-mono text-xs text-zinc-700">
                    {item.standardRate != null ? `$${item.standardRate.toFixed(2)}` : '—'}
                  </td>

                  {/* Editable: natspecRef */}
                  <td className="px-4 py-2.5">
                    {editingId === item.id ? (
                      <input
                        className="w-20 px-2 py-1 text-xs border border-blue-400 rounded focus:outline-none"
                        value={editValues.natspecRef ?? ''}
                        onChange={(e) => setEditValues((v) => ({ ...v, natspecRef: e.target.value }))}
                      />
                    ) : (
                      <span className="text-xs text-zinc-400">{item.natspecRef ?? '—'}</span>
                    )}
                  </td>

                  {/* Editable: asRef */}
                  <td className="px-4 py-2.5">
                    {editingId === item.id ? (
                      <input
                        className="w-20 px-2 py-1 text-xs border border-blue-400 rounded focus:outline-none"
                        value={editValues.asRef ?? ''}
                        onChange={(e) => setEditValues((v) => ({ ...v, asRef: e.target.value }))}
                      />
                    ) : (
                      <span className="text-xs text-zinc-400">{item.asRef ?? '—'}</span>
                    )}
                  </td>

                  {/* Active toggle */}
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() =>
                        startTransition(async () => {
                          await updateReferenceItem(item.id, { isActive: !item.isActive });
                        })
                      }
                      className={`w-8 h-4 rounded-full transition-colors ${item.isActive ? 'bg-green-500' : 'bg-zinc-300'}`}
                    >
                      <div className={`w-3 h-3 bg-white rounded-full mx-0.5 transition-transform ${item.isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-2.5">
                    {editingId === item.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(item.id)}
                          disabled={isPending}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Save
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-zinc-400 hover:underline">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(item)} className="text-xs text-blue-600 hover:underline">
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add slide panel */}
      <SlidePanel isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Reference Item">
        <form
          action={async (fd: FormData) => {
            await createReferenceItem(fd);
            setShowAdd(false);
          }}
          className="space-y-4 p-4"
        >
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Agero Ref *</label>
            <input name="ageroRef" required placeholder="e.g. PA.PART.64FH" className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Display Name *</label>
            <input name="displayName" required className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Trade Group *</label>
            <select name="tradeSectionCode" required className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              {TRADE_GROUPS.filter((g) => g.code !== 'ALL').map((g) => (
                <option key={g.code} value={g.code}>{g.code} — {g.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Unit *</label>
            <select name="unit" required className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              {UNITS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Bluebeam Tool Type *</label>
            <select name="bluebeamToolType" required className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              {TOOL_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">NatSpec Ref</label>
            <input name="natspecRef" placeholder="e.g. 0522" className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">AS Ref</label>
            <input name="asRef" placeholder="e.g. AS2589" className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="pt-2 flex gap-3">
            <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
              Add Item
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm border border-zinc-200 rounded-md hover:bg-zinc-50">
              Cancel
            </button>
          </div>
        </form>
      </SlidePanel>
    </div>
  );
}
