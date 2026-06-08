"use client";

import { useActionState, useState } from "react";
import type { DilapidationState, DilapidationPayload, DilapidationPin } from "./actions";

const CONDITIONS = ["Good", "Fair", "Poor", "Damaged"];

interface Props {
  submitAction: (prev: DilapidationState, fd: FormData) => Promise<DilapidationState>;
  floorPlanUrl: string | null;
  defaultRecipients: string[];
}

export function DilapidationForm({ submitAction, floorPlanUrl, defaultRecipients }: Props) {
  const [state, formAction, pending] = useActionState(submitAction, {});
  const [pins, setPins] = useState<DilapidationPin[]>([]);
  const [placingPin, setPlacingPin] = useState(false);
  const [editingPin, setEditingPin] = useState<number | null>(null);
  const [recipients, setRecipients] = useState<string[]>(defaultRecipients);
  const [recipientInput, setRecipientInput] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  const isImage = floorPlanUrl && !floorPlanUrl.toLowerCase().endsWith(".pdf");

  function handleFloorPlanClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!placingPin) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const pinNumber = pins.length + 1;
    setPins((prev) => [
      ...prev,
      { pinNumber, x, y, description: "", condition: "Good", photoUrls: [] },
    ]);
    setPlacingPin(false);
    setEditingPin(pinNumber - 1);
  }

  function updatePin(index: number, patch: Partial<DilapidationPin>) {
    setPins((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function removePin(index: number) {
    setPins((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((p, i) => ({ ...p, pinNumber: i + 1 })),
    );
    setEditingPin(null);
  }

  function addRecipient() {
    const email = recipientInput.trim();
    if (email && !recipients.includes(email)) {
      setRecipients((prev) => [...prev, email]);
    }
    setRecipientInput("");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!pins.length) {
      e.preventDefault();
      setClientError("Add at least one survey item to submit.");
      return;
    }
    for (const pin of pins) {
      if (!pin.description.trim()) {
        e.preventDefault();
        setClientError(`Pin ${pin.pinNumber} needs a description.`);
        return;
      }
    }
    setClientError(null);
    const payload: DilapidationPayload = {
      conductedAt: (e.currentTarget.elements.namedItem("conductedAt") as HTMLInputElement).value,
      pins,
      notes: (e.currentTarget.elements.namedItem("notes") as HTMLTextAreaElement).value,
      emailRecipients: recipients,
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
          Survey date
        </label>
        <input
          name="conductedAt"
          type="datetime-local"
          defaultValue={new Date().toISOString().slice(0, 16)}
          required
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      {/* Floor plan with pins */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Survey items — {pins.length} recorded
          </h2>
          <button
            type="button"
            onClick={() => setPlacingPin(true)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              placingPin
                ? "bg-blue-600 text-white"
                : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400"
            }`}
          >
            {placingPin ? "Click floor plan to place pin…" : "+ Add pin"}
          </button>
        </div>

        {isImage ? (
          <div
            className={`relative overflow-hidden rounded-lg border ${placingPin ? "border-blue-400 cursor-crosshair" : "border-zinc-200 dark:border-zinc-700"}`}
            onClick={handleFloorPlanClick}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={floorPlanUrl!} alt="Floor plan" className="w-full" draggable={false} />
            {pins.map((pin, i) => (
              <button
                key={pin.pinNumber}
                type="button"
                onClick={(e) => { e.stopPropagation(); setEditingPin(editingPin === i ? null : i); }}
                className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-lg hover:bg-red-700"
                style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
              >
                {pin.pinNumber}
              </button>
            ))}
          </div>
        ) : floorPlanUrl ? (
          <p className="text-xs text-zinc-500">
            Floor plan is a PDF — pin placement only works with image floor plans.
            <a href={floorPlanUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 hover:underline">View PDF →</a>
          </p>
        ) : (
          <div className="rounded-lg border-2 border-dashed border-zinc-200 p-8 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500">No floor plan uploaded. You can still add items manually below.</p>
          </div>
        )}

        {/* Pin detail editor */}
        {editingPin !== null && pins[editingPin] && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800/50 dark:bg-blue-950/20 space-y-3">
            <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
              Editing Pin {pins[editingPin].pinNumber}
            </p>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={pins[editingPin].description}
                onChange={(e) => updatePin(editingPin, { description: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Condition
              </label>
              <select
                value={pins[editingPin].condition}
                onChange={(e) => updatePin(editingPin, { condition: e.target.value })}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Photos
              </label>
              <input
                type="file"
                name={`photo_pin_${pins[editingPin].pinNumber}`}
                accept="image/*"
                multiple
                className="text-xs"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditingPin(null)}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700"
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => removePin(editingPin)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800/50"
              >
                Remove pin
              </button>
            </div>
          </div>
        )}

        {/* Add pin without floor plan */}
        {!isImage && (
          <button
            type="button"
            onClick={() => {
              const pinNumber = pins.length + 1;
              setPins((prev) => [...prev, { pinNumber, x: 0, y: 0, description: "", condition: "Good", photoUrls: [] }]);
              setEditingPin(pins.length);
            }}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            + Add survey item manually
          </button>
        )}

        {/* Pin summary list */}
        {pins.length > 0 && (
          <div className="space-y-1">
            {pins.map((pin, i) => (
              <div
                key={pin.pinNumber}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-700 dark:bg-red-900/40">
                  {pin.pinNumber}
                </span>
                <span className="flex-1 text-xs text-zinc-600 dark:text-zinc-400 truncate">
                  {pin.description || <em>No description yet</em>}
                </span>
                <span className={`text-xs ${pin.condition === "Good" ? "text-green-600" : pin.condition === "Damaged" ? "text-red-600" : "text-amber-600"}`}>
                  {pin.condition}
                </span>
                <button
                  type="button"
                  onClick={() => setEditingPin(i)}
                  className="text-xs text-zinc-400 hover:text-zinc-600"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          General notes
        </label>
        <textarea
          name="notes"
          rows={3}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      {/* Email recipients */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Email report to
        </h2>
        <p className="text-xs text-zinc-500">
          The PDF report will be emailed to Director, PM, building manager, and client superintendent.
        </p>
        {recipients.map((r) => (
          <div key={r} className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">{r}</span>
            <button
              type="button"
              onClick={() => setRecipients((prev) => prev.filter((x) => x !== r))}
              className="text-zinc-400 hover:text-red-500"
            >
              ×
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            type="email"
            value={recipientInput}
            onChange={(e) => setRecipientInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRecipient())}
            placeholder="Add email address…"
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <button
            type="button"
            onClick={addRecipient}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400"
          >
            Add
          </button>
        </div>
      </div>

      <input type="hidden" name="payload" />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Submit dilapidation report"}
      </button>
    </form>
  );
}
