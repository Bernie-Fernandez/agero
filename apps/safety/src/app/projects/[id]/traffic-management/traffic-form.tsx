"use client";

import { useActionState, useState } from "react";
import { ControlsEditor } from "@/components/controls-editor";
import { isPpeOnly, type ControlMeasure } from "@/lib/hierarchy-of-controls";
import { TRAFFIC_REVIEW_ITEMS, AS_REFERENCE } from "./constants";
import type { TrafficState, TrafficPayload } from "./actions";

type Answer = "YES" | "NO" | "NA";
interface Hazard {
  hazard: string;
  riskRating: string;
}

interface Props {
  submitAction: (prev: TrafficState, fd: FormData) => Promise<TrafficState>;
}

export function TrafficForm({ submitAction }: Props) {
  const [state, formAction, pending] = useActionState(submitAction, {});
  const [answers, setAnswers] = useState<Record<string, Answer>>(
    Object.fromEntries(TRAFFIC_REVIEW_ITEMS.map((q) => [q.id, "NA" as Answer])),
  );
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [hazards, setHazards] = useState<Hazard[]>([
    { hazard: "Vehicle / pedestrian interaction at site access", riskRating: "High" },
  ]);
  const [controls, setControls] = useState<ControlMeasure[]>([]);
  const [justification, setJustification] = useState("");
  const [notes, setNotes] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  function updateHazard(i: number, patch: Partial<Hazard>) {
    setHazards((prev) => prev.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const validHazards = hazards.filter((h) => h.hazard.trim());
    if (validHazards.length === 0) {
      e.preventDefault();
      setClientError("At least one traffic hazard is required.");
      return;
    }
    const valid = controls.filter((c) => c.description.trim());
    if (valid.length === 0) {
      e.preventDefault();
      setClientError("At least one control measure is required.");
      return;
    }
    if (isPpeOnly(controls) && !justification.trim()) {
      e.preventDefault();
      setClientError("PPE-only justification is required — consider higher-level controls first.");
      return;
    }
    setClientError(null);
    const payload: TrafficPayload = {
      conductedAt: (e.currentTarget.elements.namedItem("conductedAt") as HTMLInputElement).value,
      reviewItems: TRAFFIC_REVIEW_ITEMS.map((q) => ({
        id: q.id,
        answer: answers[q.id],
        notes: itemNotes[q.id] ?? "",
      })),
      hazards: validHazards,
      controls: valid,
      ppeJustification: justification.trim(),
      notes: notes.trim(),
    };
    const hidden = e.currentTarget.elements.namedItem("payload") as HTMLInputElement | null;
    if (hidden) hidden.value = JSON.stringify(payload);
  }

  const error = clientError ?? state.error;

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Review date</label>
        <input
          name="conductedAt"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      {/* Review checklist */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Traffic Management Review Checklist</h2>
          <p className="text-xs text-zinc-500">Aligned to {AS_REFERENCE}</p>
        </div>
        {TRAFFIC_REVIEW_ITEMS.map((q) => (
          <div key={q.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
            <p className="text-xs text-zinc-700 dark:text-zinc-300">{q.question}</p>
            <div className="mt-2 flex items-center gap-2">
              {(["YES", "NO", "NA"] as Answer[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: a }))}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${
                    answers[q.id] === a
                      ? a === "YES"
                        ? "bg-green-600 text-white"
                        : a === "NO"
                          ? "bg-red-600 text-white"
                          : "bg-zinc-500 text-white"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {a}
                </button>
              ))}
              <input
                type="text"
                value={itemNotes[q.id] ?? ""}
                onChange={(e) => setItemNotes((prev) => ({ ...prev, [q.id]: e.target.value }))}
                placeholder="Notes…"
                className="ml-2 flex-1 rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Hazard assessment */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Traffic Hazard Risk Assessment</h2>
          <button
            type="button"
            onClick={() => setHazards((prev) => [...prev, { hazard: "", riskRating: "Medium" }])}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            + Add hazard
          </button>
        </div>
        {hazards.map((h, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_auto]">
            <input
              type="text"
              value={h.hazard}
              onChange={(e) => updateHazard(i, { hazard: e.target.value })}
              placeholder="Traffic hazard…"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
            <select
              value={h.riskRating}
              onChange={(e) => updateHazard(i, { riskRating: e.target.value })}
              className="rounded-lg border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              {["Low", "Medium", "High", "Extreme"].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {hazards.length > 1 && (
              <button
                type="button"
                onClick={() => setHazards((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-xs text-red-600 hover:underline dark:text-red-400"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <ControlsEditor
          controls={controls}
          onChange={setControls}
          justification={justification}
          onJustificationChange={setJustification}
        />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Additional notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
      </div>

      <input type="hidden" name="payload" />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save traffic management review"}
      </button>
    </form>
  );
}
