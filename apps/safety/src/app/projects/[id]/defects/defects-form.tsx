"use client";

import { useActionState, useState } from "react";
import type { DefectsState, DefectsPayload, DefectItemInput } from "./actions";

interface Props {
  submitAction: (prev: DefectsState, fd: FormData) => Promise<DefectsState>;
  floorPlanUrl: string | null;
}

const STATUSES = [
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETE", label: "Complete" },
] as const;

export function DefectsForm({ submitAction, floorPlanUrl }: Props) {
  const [state, formAction, pending] = useActionState(submitAction, {});
  const [defects, setDefects] = useState<DefectItemInput[]>([]);
  const [placingPin, setPlacingPin] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  const isImage = floorPlanUrl && !floorPlanUrl.toLowerCase().endsWith(".pdf");

  function handleFloorPlanClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!placingPin) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const pinNumber = defects.length + 1;
    setDefects((prev) => [
      ...prev,
      {
        pinNumber,
        x,
        y,
        description: "",
        tradeResponsible: "",
        dueDate: "",
        status: "OPEN",
        photoUrls: [],
        notes: "",
      },
    ]);
    setPlacingPin(false);
    setEditingIdx(defects.length);
  }

  function updateDefect(index: number, patch: Partial<DefectItemInput>) {
    setDefects((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function removeDefect(index: number) {
    setDefects((prev) =>
      prev.filter((_, i) => i !== index).map((d, i) => ({ ...d, pinNumber: i + 1 })),
    );
    setEditingIdx(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!defects.length) {
      e.preventDefault();
      setClientError("Add at least one defect item.");
      return;
    }
    for (const d of defects) {
      if (!d.description.trim()) {
        e.preventDefault();
        setClientError(`Defect ${d.pinNumber} needs a description.`);
        return;
      }
    }
    setClientError(null);
    const payload: DefectsPayload = {
      conductedAt: (e.currentTarget.elements.namedItem("conductedAt") as HTMLInputElement).value,
      defects,
      notes: (e.currentTarget.elements.namedItem("notes") as HTMLTextAreaElement).value,
    };
    const hidden = (e.currentTarget as HTMLFormElement).elements.namedItem("payload") as HTMLInputElement | null;
    if (hidden) hidden.value = JSON.stringify(payload);
  }

  const error = clientError ?? state.error;

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-6" encType="multipart/form-data">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
          Inspection date
        </label>
        <input
          name="conductedAt"
          type="datetime-local"
          defaultValue={new Date().toISOString().slice(0, 16)}
          required
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Defect items — {defects.length} recorded
          </h2>
          <button
            type="button"
            onClick={() => isImage ? setPlacingPin(true) : (() => {
              const pinNumber = defects.length + 1;
              setDefects((prev) => [...prev, { pinNumber, x: 0, y: 0, description: "", tradeResponsible: "", dueDate: "", status: "OPEN", photoUrls: [], notes: "" }]);
              setEditingIdx(defects.length);
            })()}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              placingPin ? "bg-blue-600 text-white" : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400"
            }`}
          >
            {placingPin ? "Click floor plan to place…" : "+ Add defect"}
          </button>
        </div>

        {isImage && (
          <div
            className={`relative overflow-hidden rounded-lg border ${placingPin ? "border-blue-400 cursor-crosshair" : "border-zinc-200 dark:border-zinc-700"}`}
            onClick={handleFloorPlanClick}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={floorPlanUrl!} alt="Floor plan" className="w-full" draggable={false} />
            {defects.map((d, i) => {
              const colorClass = d.status === "COMPLETE" ? "bg-green-600" : d.status === "IN_PROGRESS" ? "bg-amber-500" : "bg-red-600";
              return (
                <button
                  key={d.pinNumber}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setEditingIdx(editingIdx === i ? null : i); }}
                  className={`absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ${colorClass} text-[10px] font-bold text-white shadow-lg`}
                  style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%` }}
                >
                  {d.pinNumber}
                </button>
              );
            })}
          </div>
        )}

        {editingIdx !== null && defects[editingIdx] && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800/50 dark:bg-blue-950/20 space-y-3">
            <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
              Defect {defects[editingIdx].pinNumber}
            </p>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={defects[editingIdx].description}
                onChange={(e) => updateDefect(editingIdx, { description: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Trade responsible
                </label>
                <input
                  type="text"
                  value={defects[editingIdx].tradeResponsible}
                  onChange={(e) => updateDefect(editingIdx, { tradeResponsible: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Due date
                </label>
                <input
                  type="date"
                  value={defects[editingIdx].dueDate}
                  onChange={(e) => updateDefect(editingIdx, { dueDate: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Status</label>
              <div className="flex gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => updateDefect(editingIdx, { status: s.value as DefectItemInput["status"] })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      defects[editingIdx].status === s.value
                        ? s.value === "COMPLETE" ? "bg-green-700 text-white" : s.value === "IN_PROGRESS" ? "bg-amber-500 text-white" : "bg-red-600 text-white"
                        : "border border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Photos</label>
              <input type="file" name={`photo_defect_${defects[editingIdx].pinNumber}`} accept="image/*" multiple className="text-xs" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditingIdx(null)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700">Done</button>
              <button type="button" onClick={() => removeDefect(editingIdx)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800/50">Remove</button>
            </div>
          </div>
        )}

        {defects.length > 0 && (
          <div className="space-y-1">
            {defects.map((d, i) => (
              <div key={d.pinNumber} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${d.status === "COMPLETE" ? "bg-green-600" : d.status === "IN_PROGRESS" ? "bg-amber-500" : "bg-red-600"}`}>{d.pinNumber}</span>
                <span className="flex-1 text-xs text-zinc-600 dark:text-zinc-400 truncate">{d.description || <em>No description</em>}</span>
                {d.tradeResponsible && <span className="text-xs text-zinc-400">{d.tradeResponsible}</span>}
                <button type="button" onClick={() => setEditingIdx(i)} className="text-xs text-zinc-400 hover:text-zinc-600">Edit</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Notes</label>
        <textarea name="notes" rows={3} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
      </div>

      <input type="hidden" name="payload" />
      <button type="submit" disabled={pending} className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-60">
        {pending ? "Saving…" : "Save defects inspection"}
      </button>
    </form>
  );
}
