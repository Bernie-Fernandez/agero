"use client";

import { useActionState, useState } from "react";
import type { IncidentState, IncidentPayload } from "./actions";

const INCIDENT_TYPES = [
  { value: "INJURY", label: "Injury" },
  { value: "NEAR_MISS", label: "Near Miss" },
  { value: "PROPERTY_DAMAGE", label: "Property Damage" },
  { value: "ENVIRONMENTAL", label: "Environmental" },
  { value: "PSYCHOLOGICAL", label: "Psychological (Psych Health Regs 2025)" },
  { value: "OTHER", label: "Other" },
];

// WorkSafe notifiable: injury requiring medical treatment, dangerous occurrence, death, etc.
const NOTIFIABLE_TYPES = ["INJURY", "NEAR_MISS", "PSYCHOLOGICAL"];

interface Witness {
  name: string;
  contact: string;
}

interface Props {
  submitAction: (prev: IncidentState, fd: FormData) => Promise<IncidentState>;
}

export function IncidentForm({ submitAction }: Props) {
  const [state, formAction, pending] = useActionState(submitAction, {});
  const [incidentType, setIncidentType] = useState("");
  const [workSafeNotifiable, setWorkSafeNotifiable] = useState(false);
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
  const [clientError, setClientError] = useState<string | null>(null);

  const isPsych = incidentType === "PSYCHOLOGICAL";
  const isInjury = incidentType === "INJURY";

  function addWitness() {
    setWitnesses((prev) => [...prev, { name: "", contact: "" }]);
  }

  function updateWitness(i: number, patch: Partial<Witness>) {
    setWitnesses((prev) => prev.map((w, idx) => (idx === i ? { ...w, ...patch } : w)));
  }

  function removeWitness(i: number) {
    setWitnesses((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    const location = (form.elements.namedItem("location") as HTMLInputElement).value.trim();
    const description = (form.elements.namedItem("description") as HTMLTextAreaElement).value.trim();
    if (!incidentType) {
      e.preventDefault();
      setClientError("Please select an incident type.");
      return;
    }
    if (!location) {
      e.preventDefault();
      setClientError("Location is required.");
      return;
    }
    if (!description) {
      e.preventDefault();
      setClientError("Description is required.");
      return;
    }
    setClientError(null);
    const payload: IncidentPayload = {
      incidentType: incidentType as IncidentPayload["incidentType"],
      incidentAt: (form.elements.namedItem("incidentAt") as HTMLInputElement).value,
      location,
      description,
      injuredPersonName: (form.elements.namedItem("injuredPersonName") as HTMLInputElement)?.value ?? "",
      injuredPersonOrg: (form.elements.namedItem("injuredPersonOrg") as HTMLInputElement)?.value ?? "",
      workSafeNotifiable,
      workSafeRefNumber: (form.elements.namedItem("workSafeRefNumber") as HTMLInputElement)?.value ?? "",
      workSafeNotifiedAt: (form.elements.namedItem("workSafeNotifiedAt") as HTMLInputElement)?.value ?? "",
      psychosocialDetails: (form.elements.namedItem("psychosocialDetails") as HTMLTextAreaElement)?.value ?? "",
      witnesses: witnesses.filter((w) => w.name.trim()),
      immediateActions: (form.elements.namedItem("immediateActions") as HTMLTextAreaElement)?.value ?? "",
    };
    const hidden = form.elements.namedItem("payload") as HTMLInputElement | null;
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

      {/* Classification */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Incident classification</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {INCIDENT_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setIncidentType(t.value);
                if (!NOTIFIABLE_TYPES.includes(t.value)) setWorkSafeNotifiable(false);
              }}
              className={`rounded-lg border px-3 py-2 text-xs font-medium text-left ${
                incidentType === t.value
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-200 text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {incidentType && NOTIFIABLE_TYPES.includes(incidentType) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-950/20">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-2">
              WorkSafe notification may be required
            </p>
            <label className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
              <input
                type="checkbox"
                checked={workSafeNotifiable}
                onChange={(e) => setWorkSafeNotifiable(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              This incident is notifiable to WorkSafe Victoria
            </label>
            {workSafeNotifiable && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800/50 dark:bg-red-950/20">
                <p className="text-xs font-bold text-red-700 dark:text-red-300">
                  ⚠ You must notify WorkSafe within 48 hours of becoming aware of this incident.
                </p>
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  Call:{" "}
                  <a href="tel:132360" className="font-bold underline">
                    132 360
                  </a>{" "}
                  (24/7 emergency line)
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-red-700 dark:text-red-300 mb-1">
                      WorkSafe reference number
                    </label>
                    <input
                      name="workSafeRefNumber"
                      type="text"
                      placeholder="Enter after calling"
                      className="w-full rounded border border-red-200 px-3 py-1.5 text-sm dark:border-red-800/50 dark:bg-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-red-700 dark:text-red-300 mb-1">
                      Date/time notified
                    </label>
                    <input
                      name="workSafeNotifiedAt"
                      type="datetime-local"
                      className="w-full rounded border border-red-200 px-3 py-1.5 text-sm dark:border-red-800/50 dark:bg-zinc-900"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Incident details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Date and time of incident <span className="text-red-500">*</span>
            </label>
            <input
              name="incidentAt"
              type="datetime-local"
              defaultValue={new Date().toISOString().slice(0, 16)}
              required
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Location <span className="text-red-500">*</span>
            </label>
            <input
              name="location"
              type="text"
              required
              placeholder="e.g. Level 3 – east stairwell"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            name="description"
            required
            rows={4}
            placeholder="Describe what happened, how, and what was involved."
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        {isInjury && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Injured person name
              </label>
              <input
                name="injuredPersonName"
                type="text"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Injured person company
              </label>
              <input
                name="injuredPersonOrg"
                type="text"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
          </div>
        )}
        {isPsych && (
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Psychosocial details (VIC Psych Health Regs 2025)
            </label>
            <p className="text-xs text-zinc-500 mb-2">
              Describe the psychosocial hazard involved (e.g., workload, bullying, trauma exposure, poor support).
            </p>
            <textarea
              name="psychosocialDetails"
              rows={3}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
            Immediate actions taken
          </label>
          <textarea
            name="immediateActions"
            rows={3}
            placeholder="First aid given, area made safe, WorkSafe notified, etc."
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>
      </div>

      {/* Witnesses */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Witnesses</h2>
          <button
            type="button"
            onClick={addWitness}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            + Add witness
          </button>
        </div>
        {witnesses.length === 0 && (
          <p className="text-xs text-zinc-500">No witnesses recorded.</p>
        )}
        {witnesses.map((w, i) => (
          <div key={i} className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Name</label>
              <input
                type="text"
                value={w.name}
                onChange={(e) => updateWitness(i, { name: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Contact</label>
              <input
                type="text"
                value={w.contact}
                onChange={(e) => updateWitness(i, { contact: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
            <button
              type="button"
              onClick={() => removeWitness(i)}
              className="col-span-2 text-left text-xs text-red-600 hover:underline dark:text-red-400"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <input type="hidden" name="payload" />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit incident report"}
      </button>
    </form>
  );
}
