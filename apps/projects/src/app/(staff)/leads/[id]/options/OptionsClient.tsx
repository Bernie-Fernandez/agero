'use client';
import { useState, useTransition } from 'react';
import { showToast, ToastContainer } from '@/components/Toast';
import { createOption, toggleLineOption } from '../actions';

type Line = { id: string; description: string; total: number | string };
type OptionLine = { lineId: string; line: Line };
type Option = { id: string; name: string; description: string | null; totalCost: number | string; lines: OptionLine[] };

function fmt(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);
}

export default function OptionsClient({
  estimateId,
  options,
  optionLines,
}: {
  estimateId: string;
  options: Option[];
  optionLines: Line[];
}) {
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  function handleCreate() {
    if (!newName.trim()) return;
    startTransition(async () => {
      await createOption(estimateId, newName.trim());
      setNewName('');
      setShowAdd(false);
      showToast('Option created');
    });
  }

  return (
    <div className="h-full overflow-auto bg-zinc-50 p-6">
      <ToastContainer />
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-zinc-800">Options & Risk/Opportunity Items</h2>
          <button onClick={() => setShowAdd(true)} className="px-3 py-1.5 text-sm bg-brand text-white rounded-md hover:bg-brand/90">+ New Option Group</button>
        </div>

        {showAdd && (
          <div className="bg-white border border-zinc-200 rounded-lg p-4 flex gap-3">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Option name…" className="flex-1 border border-zinc-200 rounded px-3 py-1.5 text-sm" onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
            <button onClick={handleCreate} disabled={pending} className="px-3 py-1.5 text-sm bg-brand text-white rounded disabled:opacity-50">Create</button>
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm border border-zinc-200 rounded">Cancel</button>
          </div>
        )}

        {/* Risk/Opp lines (isRisk flag) */}
        <div className="bg-white border border-zinc-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-amber-700 mb-3">Risk & Opportunity Lines</h3>
          {optionLines.filter((l): l is Line => true).length === 0 ? (
            <p className="text-sm text-zinc-400">No lines flagged as R&O or Option. Flag lines in the Cost Plan.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-zinc-200"><th className="py-1.5 text-left text-xs font-semibold text-zinc-500">Description</th><th className="py-1.5 text-right text-xs font-semibold text-zinc-500">Total</th></tr></thead>
              <tbody>
                {optionLines.map((line) => (
                  <tr key={line.id} className="border-b border-zinc-100">
                    <td className="py-2 text-zinc-700">{line.description}</td>
                    <td className="py-2 text-right text-zinc-900 font-medium">{fmt(Number(line.total))}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-zinc-200">
                  <td className="py-2 font-semibold text-zinc-700">Total</td>
                  <td className="py-2 text-right font-bold text-zinc-900">{fmt(optionLines.reduce((s, l) => s + Number(l.total), 0))}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Option groups */}
        {options.map((opt) => {
          const total = opt.lines.reduce((s, ol) => s + Number(ol.line.total), 0);
          return (
            <div key={opt.id} className="bg-white border border-zinc-200 rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-purple-700">{opt.name}</h3>
                <span className="text-sm font-bold text-zinc-900">{fmt(total)}</span>
              </div>
              {opt.description && <p className="text-xs text-zinc-500 mb-3">{opt.description}</p>}
              {opt.lines.length === 0 ? (
                <p className="text-xs text-zinc-400">No lines assigned to this option group yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {opt.lines.map((ol) => (
                      <tr key={ol.lineId} className="border-b border-zinc-100">
                        <td className="py-1.5 text-zinc-700">{ol.line.description}</td>
                        <td className="py-1.5 text-right text-zinc-900">{fmt(Number(ol.line.total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}

        {options.length === 0 && !showAdd && (
          <div className="text-center py-12 text-zinc-400 text-sm">No option groups yet. Create one to group optional line items.</div>
        )}
      </div>
    </div>
  );
}
