"use client";

import { useActionState, useEffect, useState } from "react";
import type { LegislationState } from "./actions";

interface Props {
  leg: {
    id: string;
    title: string;
    reference: string | null;
    category: string;
    version: string;
    effectiveDate: string | null; // yyyy-mm-dd
    lastReviewedDate: string | null;
    affectsTemplateKeys: string[];
    notes: string | null;
    updatedByName: string | null;
  };
  submitAction: (prev: LegislationState, fd: FormData) => Promise<LegislationState>;
}

const CATEGORY_LABELS: Record<string, string> = {
  ACT: "Act",
  REGULATION: "Regulation",
  STANDARD: "Standard",
  COMPLIANCE_CODE: "Compliance Code",
  PRACTICE_NOTE: "Practice Note",
};

export function LegislationEditForm({ leg, submitAction }: Props) {
  const [state, formAction, pending] = useActionState(submitAction, {});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

  return (
    <div className="px-5 py-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{leg.title}</p>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {CATEGORY_LABELS[leg.category] ?? leg.category}
            </span>
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
              v{leg.version}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {leg.reference ?? ""}
            {leg.effectiveDate ? ` · effective ${new Date(leg.effectiveDate).toLocaleDateString("en-AU")}` : ""}
            {leg.affectsTemplateKeys.length > 0 ? ` · affects ${leg.affectsTemplateKeys.length} template(s)` : ""}
          </p>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          {open ? "Cancel" : "Update →"}
        </button>
      </div>

      {open && (
        <form action={formAction} className="mt-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700 space-y-3">
          {state.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-300">
              {state.error}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Version *</label>
              <input name="version" defaultValue={leg.version} required className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Effective date</label>
              <input name="effectiveDate" type="date" defaultValue={leg.effectiveDate ?? ""} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Notes</label>
            <textarea name="notes" defaultValue={leg.notes ?? ""} rows={2} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Changing the version flags affected templates for review and alerts Directors.
          </p>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save update"}
          </button>
        </form>
      )}
    </div>
  );
}
