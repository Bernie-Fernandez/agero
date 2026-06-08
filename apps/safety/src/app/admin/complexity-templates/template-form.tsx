"use client";

import { useActionState } from "react";
import { HRW_CLASSIFICATIONS } from "@/app/projects/[id]/pre-start/constants";
import { createTemplate } from "./actions";

const RISK_LEVELS = ["Low", "Medium", "High", "Critical"] as const;

export function TemplateForm() {
  const [state, action, pending] = useActionState(createTemplate, {});

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          Template added.
        </p>
      )}

      <label className="block">
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Template name <span className="text-red-500">*</span>
        </span>
        <input
          name="name"
          type="text"
          placeholder="e.g. Facade glazing — external scaffold"
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Risk level <span className="text-red-500">*</span>
          </span>
          <select
            name="riskLevel"
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Links to HRW classification (optional)
          </span>
          <select
            name="hrwFlag"
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="">— None —</option>
            {HRW_CLASSIFICATIONS.map((h) => (
              <option key={h.id} value={h.id}>{h.label}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Safety planning required <span className="text-red-500">*</span>
        </span>
        <textarea
          name="safetyPlanning"
          rows={3}
          placeholder="What specific safety planning is required for this complexity?"
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Trade category (optional)
        </span>
        <input
          name="tradeCategory"
          type="text"
          placeholder="e.g. Glazing, Electrical, Hydraulics"
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "Adding…" : "Add template"}
      </button>
    </form>
  );
}
