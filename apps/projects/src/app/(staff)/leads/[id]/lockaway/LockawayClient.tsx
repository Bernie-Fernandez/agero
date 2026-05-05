'use client';
import { useState, useTransition } from 'react';
import { showToast, ToastContainer } from '@/components/Toast';
import { createLockaway } from '../actions';

type Line = { id: string; description: string; total: number | string };
type LockawayLine = { lineId: string; line: Line };
type Lockaway = { id: string; name: string; notes: string | null; lines: LockawayLine[] };

function fmt(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);
}

export default function LockawayClient({
  estimateId,
  lockaways,
  lockawayLines,
}: {
  estimateId: string;
  lockaways: Lockaway[];
  lockawayLines: Line[];
}) {
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  function handleCreate() {
    if (!newName.trim()) return;
    startTransition(async () => {
      await createLockaway(estimateId, newName.trim());
      setNewName('');
      setShowAdd(false);
      showToast('Lockaway group created');
    });
  }

  const totalLockaway = lockawayLines.reduce((s, l) => s + Number(l.total), 0);

  return (
    <div className="h-full overflow-auto bg-zinc-50 p-6">
      <ToastContainer />
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-800">Lockaway Items</h2>
            <p className="text-sm text-zinc-500 mt-0.5">Total locked away: <strong>{fmt(totalLockaway)}</strong></p>
          </div>
          <button onClick={() => setShowAdd(true)} className="px-3 py-1.5 text-sm bg-brand text-white rounded-md hover:bg-brand/90">+ New Lockaway Group</button>
        </div>

        {showAdd && (
          <div className="bg-white border border-zinc-200 rounded-lg p-4 flex gap-3">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Lockaway group name…" className="flex-1 border border-zinc-200 rounded px-3 py-1.5 text-sm" onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
            <button onClick={handleCreate} disabled={pending} className="px-3 py-1.5 text-sm bg-brand text-white rounded disabled:opacity-50">Create</button>
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm border border-zinc-200 rounded">Cancel</button>
          </div>
        )}

        {/* All lockaway-flagged lines */}
        <div className="bg-white border border-zinc-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-orange-700 mb-3">All Lockaway Lines</h3>
          {lockawayLines.length === 0 ? (
            <p className="text-sm text-zinc-400">No lines flagged as lockaway. Flag lines in the Cost Plan to see them here.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-zinc-200"><th className="py-1.5 text-left text-xs font-semibold text-zinc-500">Description</th><th className="py-1.5 text-right text-xs font-semibold text-zinc-500">Total</th></tr></thead>
              <tbody>
                {lockawayLines.map((line) => (
                  <tr key={line.id} className="border-b border-zinc-100">
                    <td className="py-2 text-zinc-700">{line.description}</td>
                    <td className="py-2 text-right font-medium text-zinc-900">{fmt(Number(line.total))}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-zinc-200">
                  <td className="py-2 font-semibold text-zinc-700">Total Locked Away</td>
                  <td className="py-2 text-right font-bold text-orange-700">{fmt(totalLockaway)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Lockaway groups */}
        {lockaways.map((lk) => {
          const total = lk.lines.reduce((s, ll) => s + Number(ll.line.total), 0);
          return (
            <div key={lk.id} className="bg-white border border-zinc-200 rounded-lg p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-orange-700">{lk.name}</h3>
                <span className="text-sm font-bold text-zinc-900">{fmt(total)}</span>
              </div>
              {lk.notes && <p className="text-xs text-zinc-500 mb-3">{lk.notes}</p>}
              {lk.lines.length === 0 ? (
                <p className="text-xs text-zinc-400">No lines in this lockaway group.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {lk.lines.map((ll) => (
                      <tr key={ll.lineId} className="border-b border-zinc-100">
                        <td className="py-1.5 text-zinc-700">{ll.line.description}</td>
                        <td className="py-1.5 text-right text-zinc-900">{fmt(Number(ll.line.total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
