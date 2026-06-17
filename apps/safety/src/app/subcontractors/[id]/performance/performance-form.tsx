"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { PerformanceState } from "./actions";

interface Props {
  projects: { id: string; name: string }[];
  submitAction: (prev: PerformanceState, fd: FormData) => Promise<PerformanceState>;
}

const RECORD_TYPES = ["OBSERVATION", "INCIDENT", "NCR", "SWMS_REJECTION", "INDUCTION", "NOTE"];

export function PerformanceForm({ projects, submitAction }: Props) {
  const [state, formAction, pending] = useActionState(submitAction, {});
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state.ok]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
      >
        + Log performance record
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-4"
    >
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-300">
          {state.error}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Type</label>
          <select name="recordType" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800">
            {RECORD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Project (optional)</label>
          <select name="projectId" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800">
            <option value="">—</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Date</label>
          <input name="occurredAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Description</label>
        <textarea name="description" rows={2} required className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save record"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          Cancel
        </button>
      </div>
    </form>
  );
}
