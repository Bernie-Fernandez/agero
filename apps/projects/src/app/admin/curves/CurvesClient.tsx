'use client';

import { useState, useTransition } from 'react';
import {
  RevenueCurveRow,
  createCurve,
  updateCurve,
  archiveCurve,
  deleteCurve,
} from '@/lib/revenue-curves/actions';

// ─── Bar chart preview ─────────────────────────────────────────────────────

function CurveChart({ weights }: { weights: number[] }) {
  const max = Math.max(...weights, 1);
  return (
    <div className="flex items-end gap-px h-10 w-full">
      {weights.map((w, i) => (
        <div
          key={i}
          title={`Period ${i + 1}: ${w}%`}
          className="flex-1 bg-blue-500 rounded-t min-h-[1px] transition-all"
          style={{ height: `${Math.max((w / max) * 40, 1)}px` }}
        />
      ))}
    </div>
  );
}

// ─── Curve form ─────────────────────────────────────────────────────────────

type FormState = {
  name: string;
  description: string;
  periodCount: 12 | 24;
  weights: string[];
};

function emptyForm(periods: 12 | 24 = 12): FormState {
  return { name: '', description: '', periodCount: periods, weights: Array(periods).fill('') };
}

function fromCurve(c: RevenueCurveRow): FormState {
  return {
    name: c.name,
    description: c.description ?? '',
    periodCount: c.periodCount as 12 | 24,
    weights: c.weights.map(String),
  };
}

function CurveForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: FormState;
  onSave: (form: FormState) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weights = form.weights.map((w) => Number(w) || 0);
  const sum = weights.reduce((a, b) => a + b, 0);
  const sumOk = Math.abs(sum - 100) <= 0.1;

  function setPeriods(n: 12 | 24) {
    const existing = form.weights.slice(0, n).map((w) => (w === '' ? '' : w));
    const padded = [...existing, ...Array(Math.max(0, n - existing.length)).fill('')];
    setForm((f) => ({ ...f, periodCount: n, weights: padded }));
  }

  function setWeight(i: number, val: string) {
    setForm((f) => {
      const w = [...f.weights];
      w[i] = val;
      return { ...f, weights: w };
    });
  }

  function evenFill() {
    const n = form.periodCount;
    const base = Math.floor((100 / n) * 100) / 100;
    const filled = Array(n).fill(String(base));
    // last cell absorbs rounding
    const remainder = (100 - base * (n - 1)).toFixed(2);
    filled[n - 1] = remainder;
    setForm((f) => ({ ...f, weights: filled }));
  }

  async function handleSave() {
    if (!sumOk) { setError(`Weights must sum to 100 (currently ${sum.toFixed(2)}).`); return; }
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.');
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-zinc-600 block mb-1">Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="border border-zinc-300 rounded-lg px-3 py-2 text-sm w-full"
            placeholder="e.g. My Custom Curve"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600 block mb-1">Description</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="border border-zinc-300 rounded-lg px-3 py-2 text-sm w-full"
            placeholder="Optional"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-zinc-600 block mb-2">Period count</label>
        <div className="flex gap-4">
          {([12, 24] as const).map((n) => (
            <label key={n} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="periodCount"
                checked={form.periodCount === n}
                onChange={() => setPeriods(n)}
                className="accent-blue-600"
              />
              {n} months
            </label>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-zinc-600">
            Weights (%) — {form.periodCount} periods
          </label>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium ${sumOk ? 'text-emerald-600' : 'text-red-600'}`}>
              Total: {sum.toFixed(2)}% {sumOk ? '✓' : '(must equal 100%)'}
            </span>
            <button
              type="button"
              onClick={evenFill}
              className="text-xs text-blue-600 hover:underline"
            >
              Distribute evenly
            </button>
          </div>
        </div>

        <div className={`grid gap-1.5 ${form.periodCount === 12 ? 'grid-cols-6' : 'grid-cols-8'}`}>
          {form.weights.map((w, i) => (
            <div key={i}>
              <div className="text-[10px] text-zinc-400 text-center mb-0.5">P{i + 1}</div>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={w}
                onChange={(e) => setWeight(i, e.target.value)}
                className="w-full text-center text-xs border border-zinc-300 rounded px-1 py-1 focus:outline-none focus:border-blue-400"
              />
            </div>
          ))}
        </div>

        {weights.some((w) => w > 0) && (
          <div className="mt-3">
            <CurveChart weights={weights} />
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-zinc-600 border border-zinc-300 rounded-lg hover:bg-zinc-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !sumOk}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Curve'}
        </button>
      </div>
    </div>
  );
}

// ─── Preview modal ──────────────────────────────────────────────────────────

function PreviewModal({ curve, onClose }: { curve: RevenueCurveRow; onClose: () => void }) {
  const max = Math.max(...curve.weights, 1);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl border border-zinc-200 p-6 w-[480px] max-w-full mx-4">
        <h3 className="text-base font-semibold text-zinc-900 mb-1">{curve.name}</h3>
        {curve.description && <p className="text-sm text-zinc-500 mb-4">{curve.description}</p>}
        <p className="text-xs text-zinc-400 mb-3">{curve.periodCount} periods · sum = {curve.weights.reduce((a, b) => a + b, 0).toFixed(2)}%</p>

        {/* Bar chart */}
        <div className="flex items-end gap-1 h-32 mb-3">
          {curve.weights.map((w, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className="w-full bg-blue-500 rounded-t"
                style={{ height: `${Math.max((w / max) * 112, 2)}px` }}
                title={`Period ${i + 1}: ${w}%`}
              />
              {curve.periodCount <= 12 && (
                <span className="text-[9px] text-zinc-400">{i + 1}</span>
              )}
            </div>
          ))}
        </div>

        {/* Weight table */}
        <div className={`grid gap-1 text-center ${curve.periodCount <= 12 ? 'grid-cols-6' : 'grid-cols-8'}`}>
          {curve.weights.map((w, i) => (
            <div key={i} className="bg-zinc-50 rounded px-1 py-0.5">
              <div className="text-[9px] text-zinc-400">P{i + 1}</div>
              <div className="text-xs font-mono text-zinc-700">{w}%</div>
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-600 border border-zinc-300 rounded-lg hover:bg-zinc-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function CurvesClient({ initialCurves }: { initialCurves: RevenueCurveRow[] }) {
  const [curves, setCurves] = useState(initialCurves);
  const [mode, setMode] = useState<'list' | 'create' | { editing: RevenueCurveRow } | { preview: RevenueCurveRow }>('list');
  const [, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const systemCurves = curves.filter((c) => c.isSystem && !c.isArchived);
  const customCurves = curves.filter((c) => !c.isSystem && !c.isArchived);
  const archivedCurves = curves.filter((c) => c.isArchived);

  async function handleCreate(form: FormState) {
    const weights = form.weights.map((w) => Number(w) || 0);
    const res = await createCurve({ name: form.name, description: form.description || undefined, periodCount: form.periodCount, weights });
    if (!res.ok) throw new Error(res.error ?? 'Failed to create.');
    // Reload from server
    const fresh = await fetch('/admin/curves').then(() => null).catch(() => null);
    void fresh;
    setCurves((prev) => [...prev, {
      id: res.id!,
      name: form.name,
      description: form.description || null,
      isSystem: false,
      isArchived: false,
      periodCount: form.periodCount,
      weights,
    }]);
    setMode('list');
  }

  async function handleUpdate(curve: RevenueCurveRow, form: FormState) {
    const weights = form.weights.map((w) => Number(w) || 0);
    const res = await updateCurve(curve.id, { name: form.name, description: form.description || undefined, periodCount: form.periodCount, weights });
    if (!res.ok) throw new Error(res.error ?? 'Failed to update.');
    setCurves((prev) => prev.map((c) => c.id === curve.id ? { ...c, name: form.name, description: form.description || null, periodCount: form.periodCount, weights } : c));
    setMode('list');
  }

  function handleArchive(curve: RevenueCurveRow) {
    setActionError(null);
    startTransition(async () => {
      const res = await archiveCurve(curve.id);
      if (!res.ok) { setActionError(res.error ?? 'Failed.'); return; }
      setCurves((prev) => prev.map((c) => c.id === curve.id ? { ...c, isArchived: !c.isArchived } : c));
    });
  }

  function handleDelete(curve: RevenueCurveRow) {
    if (!confirm(`Delete "${curve.name}"? This cannot be undone.`)) return;
    setActionError(null);
    startTransition(async () => {
      const res = await deleteCurve(curve.id);
      if (!res.ok) { setActionError(res.error ?? 'Failed.'); return; }
      setCurves((prev) => prev.filter((c) => c.id !== curve.id));
    });
  }

  function CurveRow({ c }: { c: RevenueCurveRow }) {
    return (
      <tr className="border-b hover:bg-zinc-50">
        <td className="px-4 py-3">
          <div className="font-medium text-sm text-zinc-900">{c.name}</div>
          {c.description && <div className="text-xs text-zinc-400 mt-0.5 max-w-xs truncate">{c.description}</div>}
        </td>
        <td className="px-4 py-3 text-sm text-zinc-600">{c.periodCount}</td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.isSystem ? 'bg-blue-100 text-blue-700' : 'bg-zinc-100 text-zinc-600'}`}>
            {c.isSystem ? 'System' : 'Custom'}
          </span>
        </td>
        <td className="px-4 py-3 w-40">
          <CurveChart weights={c.weights} />
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.isArchived ? 'bg-zinc-100 text-zinc-400' : 'bg-emerald-100 text-emerald-700'}`}>
            {c.isArchived ? 'Archived' : 'Active'}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMode({ preview: c })}
              className="text-xs text-blue-600 hover:underline"
            >
              Preview
            </button>
            {!c.isSystem && (
              <>
                <button
                  onClick={() => setMode({ editing: c })}
                  className="text-xs text-zinc-600 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleArchive(c)}
                  className="text-xs text-zinc-500 hover:underline"
                >
                  {c.isArchived ? 'Restore' : 'Archive'}
                </button>
                <button
                  onClick={() => handleDelete(c)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Delete
                </button>
              </>
            )}
            {c.isSystem && (
              <button
                onClick={() => handleArchive(c)}
                className="text-xs text-zinc-500 hover:underline"
              >
                {c.isArchived ? 'Restore' : 'Archive'}
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  const previewCurve = typeof mode === 'object' && 'preview' in mode ? mode.preview : null;
  const editingCurve = typeof mode === 'object' && 'editing' in mode ? mode.editing : null;

  if (mode === 'create') {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setMode('list')} className="text-sm text-zinc-500 hover:text-zinc-800">← Back</button>
          <h1 className="text-xl font-bold text-zinc-900">New Revenue Curve</h1>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-6">
          <CurveForm
            initial={emptyForm()}
            onSave={handleCreate}
            onCancel={() => setMode('list')}
          />
        </div>
      </div>
    );
  }

  if (editingCurve) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setMode('list')} className="text-sm text-zinc-500 hover:text-zinc-800">← Back</button>
          <h1 className="text-xl font-bold text-zinc-900">Edit: {editingCurve.name}</h1>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-6">
          <CurveForm
            initial={fromCurve(editingCurve)}
            onSave={(form) => handleUpdate(editingCurve, form)}
            onCancel={() => setMode('list')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-zinc-900">Revenue Curves</h1>
        <button
          onClick={() => setMode('create')}
          className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-700"
        >
          + New Curve
        </button>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">{actionError}</div>
      )}

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr className="text-xs text-zinc-500 font-medium">
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Periods</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left w-44">Preview</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {systemCurves.length > 0 && (
              <tr className="bg-blue-50">
                <td colSpan={6} className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-500">
                  System Curves
                </td>
              </tr>
            )}
            {systemCurves.map((c) => <CurveRow key={c.id} c={c} />)}

            {customCurves.length > 0 && (
              <tr className="bg-zinc-50">
                <td colSpan={6} className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Custom Curves
                </td>
              </tr>
            )}
            {customCurves.map((c) => <CurveRow key={c.id} c={c} />)}

            {archivedCurves.length > 0 && (
              <tr className="bg-zinc-50">
                <td colSpan={6} className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300">
                  Archived
                </td>
              </tr>
            )}
            {archivedCurves.map((c) => <CurveRow key={c.id} c={c} />)}

            {curves.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-400">No curves found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {previewCurve && <PreviewModal curve={previewCurve} onClose={() => setMode('list')} />}
    </div>
  );
}
