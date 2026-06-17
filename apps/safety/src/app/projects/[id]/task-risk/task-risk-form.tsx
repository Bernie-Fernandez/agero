"use client";

import { useActionState, useState } from "react";
import { ControlsEditor } from "@/components/controls-editor";
import { isPpeOnly, type ControlMeasure } from "@/lib/hierarchy-of-controls";
import type { TaskRiskState, TaskRiskPayload } from "./actions";

interface Hazard {
  hazard: string;
  riskRating: string;
}

interface Props {
  submitAction: (prev: TaskRiskState, fd: FormData) => Promise<TaskRiskState>;
}

export function TaskRiskForm({ submitAction }: Props) {
  const [state, formAction, pending] = useActionState(submitAction, {});
  const [taskDescription, setTaskDescription] = useState("");
  const [location, setLocation] = useState("");
  const [hazards, setHazards] = useState<Hazard[]>([{ hazard: "", riskRating: "Medium" }]);
  const [controls, setControls] = useState<ControlMeasure[]>([]);
  const [justification, setJustification] = useState("");
  const [residualRisk, setResidualRisk] = useState("Low");
  const [clientError, setClientError] = useState<string | null>(null);

  function updateHazard(i: number, patch: Partial<Hazard>) {
    setHazards((prev) => prev.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!taskDescription.trim()) {
      e.preventDefault();
      setClientError("Task description is required.");
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
    const payload: TaskRiskPayload = {
      conductedAt: (e.currentTarget.elements.namedItem("conductedAt") as HTMLInputElement).value,
      taskDescription: taskDescription.trim(),
      location: location.trim(),
      hazards: hazards.filter((h) => h.hazard.trim()),
      controls: valid,
      ppeJustification: justification.trim(),
      residualRisk,
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

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Assessment date</label>
          <input
            name="conductedAt"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Task / activity</label>
          <textarea
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            rows={3}
            placeholder="Describe the task being assessed…"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Hazards identified</h2>
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
              placeholder="Hazard…"
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
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Residual risk after controls</label>
        <select
          value={residualRisk}
          onChange={(e) => setResidualRisk(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        >
          {["Low", "Medium", "High"].map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <input type="hidden" name="payload" />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save risk assessment"}
      </button>
    </form>
  );
}
