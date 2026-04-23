'use client';
import { useState, useTransition } from 'react';
import { showToast, ToastContainer } from '@/components/Toast';
import { createInsightTag, assignTagToLine } from '../actions';

type Tag = {
  id: string;
  name: string;
  color: string;
  lineAssignments: { line: { id: string; description: string; total: number | string } }[];
};

type LineTag = { tag: { id: string; name: string; color: string } };
type Line = { id: string; description: string; total: number | string; tags: LineTag[] };

function fmt(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);
}

const TAG_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#64748b'];

export default function InsightsClient({
  estimateId,
  tags,
  lines,
}: {
  estimateId: string;
  tags: Tag[];
  lines: Line[];
}) {
  const [pending, startTransition] = useTransition();
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [showAdd, setShowAdd] = useState(false);
  const [view, setView] = useState<'tags' | 'assign'>('tags');

  function handleCreateTag() {
    if (!newTagName.trim()) return;
    startTransition(async () => {
      await createInsightTag(estimateId, newTagName.trim(), newTagColor);
      setNewTagName('');
      setShowAdd(false);
      showToast('Tag created');
    });
  }

  function handleToggle(lineId: string, tagId: string, hasTag: boolean) {
    startTransition(async () => {
      await assignTagToLine(lineId, tagId, estimateId, !hasTag);
    });
  }

  return (
    <div className="h-full overflow-auto bg-zinc-50 p-6">
      <ToastContainer />
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-800">Insight Tags</h2>
          <div className="flex gap-2">
            <div className="flex border border-zinc-200 rounded-md overflow-hidden">
              <button onClick={() => setView('tags')} className={`px-3 py-1.5 text-sm ${view === 'tags' ? 'bg-brand text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'}`}>Tag Analysis</button>
              <button onClick={() => setView('assign')} className={`px-3 py-1.5 text-sm ${view === 'assign' ? 'bg-brand text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'}`}>Assign Tags</button>
            </div>
            <button onClick={() => setShowAdd(true)} className="px-3 py-1.5 text-sm bg-brand text-white rounded-md hover:bg-brand/90">+ New Tag</button>
          </div>
        </div>

        {showAdd && (
          <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
            <div className="flex gap-3">
              <input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Tag name…" className="flex-1 border border-zinc-200 rounded px-3 py-1.5 text-sm" />
              <div className="flex gap-1.5 items-center">
                {TAG_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setNewTagColor(c)} className={`w-5 h-5 rounded-full border-2 transition-transform ${newTagColor === c ? 'border-zinc-700 scale-125' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={handleCreateTag} disabled={pending} className="px-3 py-1.5 text-sm bg-brand text-white rounded disabled:opacity-50">Create</button>
              <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm border border-zinc-200 rounded">Cancel</button>
            </div>
          </div>
        )}

        {view === 'tags' && (
          <div className="grid grid-cols-2 gap-4">
            {tags.length === 0 ? (
              <div className="col-span-2 text-center py-12 text-sm text-zinc-400">No insight tags yet. Create tags to categorise your cost lines.</div>
            ) : (
              tags.map((tag) => {
                const total = tag.lineAssignments.reduce((s, a) => s + Number(a.line.total), 0);
                return (
                  <div key={tag.id} className="bg-white border border-zinc-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                      <span className="font-semibold text-sm text-zinc-800">{tag.name}</span>
                      <span className="ml-auto text-sm font-bold text-zinc-900">{fmt(total)}</span>
                    </div>
                    {tag.lineAssignments.length === 0 ? (
                      <p className="text-xs text-zinc-400">No lines tagged.</p>
                    ) : (
                      <div className="space-y-1">
                        {tag.lineAssignments.map((a) => (
                          <div key={a.line.id} className="flex justify-between text-xs">
                            <span className="text-zinc-600 truncate">{a.line.description}</span>
                            <span className="text-zinc-500 ml-2 shrink-0">{fmt(Number(a.line.total))}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {view === 'assign' && (
          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-700 w-[300px]">Line Item</span>
              {tags.map((tag) => (
                <span key={tag.id} className="text-xs font-medium text-zinc-600 w-20 text-center truncate" style={{ color: tag.color }}>{tag.name}</span>
              ))}
            </div>
            {lines.length === 0 ? (
              <p className="px-4 py-8 text-sm text-zinc-400 text-center">No lines in this estimate.</p>
            ) : (
              lines.map((line) => {
                const lineTagIds = new Set(line.tags.map((lt) => lt.tag.id));
                return (
                  <div key={line.id} className="px-4 py-2.5 border-b border-zinc-100 flex items-center gap-2 hover:bg-zinc-50">
                    <span className="text-sm text-zinc-700 truncate w-[300px]">{line.description}</span>
                    {tags.map((tag) => (
                      <div key={tag.id} className="w-20 flex justify-center">
                        <input
                          type="checkbox"
                          checked={lineTagIds.has(tag.id)}
                          disabled={pending}
                          onChange={() => handleToggle(line.id, tag.id, lineTagIds.has(tag.id))}
                          className="w-4 h-4 rounded cursor-pointer"
                          style={{ accentColor: tag.color }}
                        />
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
