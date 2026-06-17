"use client";

import { useActionState, useState } from "react";
import { ControlsEditor } from "@/components/controls-editor";
import { isPpeOnly, type ControlMeasure } from "@/lib/hierarchy-of-controls";
import type { ManualHandlingState, ManualHandlingPayload } from "./actions";

const RISK_FACTORS = [
  "Repetitive or sustained force",
  "High or sudden force",
  "Awkward or sustained postures",
  "Repetitive movements",
  "Exposure to vibration",
  "Handling heavy or unstable loads",
  "Handling people or animals",
  "Long duration / insufficient recovery",
  "Restricted work area / poor access",
];

interface Props {
  submitAction: (prev: ManualHandlingState, fd: FormData) => Promise<ManualHandlingState>;
}

export function ManualHandlingForm({ submitAction }: Props) {
  const [state, formAction, pending] = useActionState(submitAction, {});
  const [taskDescription, setTaskDescription] = useState("");
  const [location, setLocation] = useState("");
  const [riskFactors, setRiskFactors] = useState<string[]>([]);
  const [controls, setControls] = useState<ControlMeasure[]>([]);
  const [justification, setJustification] = useState("");
  const [residualRisk, setResidualRisk] = useState("Low");
  const [clientError, setClientError] = useState<string | null>(null);

  function toggleFactor(f: string) {
    setRiskFactors((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
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
    const payload: ManualHandlingPayload = {
      conductedAt: (e.currentTarget.elements.namedItem("conductedAt") as HTMLInputElement).value,
      taskDescription: taskDescription.trim(),
      location: location.trim(),
      riskFactors,
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
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Assessment date
          </label>
          <input
            name="conductedAt"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Task / activity being assessed
          </label>
          <textarea
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            rows={3}
            placeholder="Describe the manual handling task…"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Location
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
          Hazardous manual handling risk factors
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {RISK_FACTORS.map((f) => (
            <label
              key={f}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer ${
                riskFactors.includes(f)
                  ? "border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <input
                type="checkbox"
                checked={riskFactors.includes(f)}
                onChange={() => toggleFactor(f)}
                className="mt-0.5 h-4 w-4"
              />
              <span className="text-xs text-zinc-700 dark:text-zinc-300">{f}</span>
            </label>
          ))}
        </div>
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
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Residual risk after controls
        </label>
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
