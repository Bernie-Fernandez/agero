"use client";

import { useActionState } from "react";
import type { AssignState } from "./actions";

export function ProjectAssignForm({
  subOrgId,
  availableProjects,
  assignAction,
}: {
  subOrgId: string;
  availableProjects: { id: string; name: string }[];
  assignAction: (prev: AssignState, fd: FormData) => Promise<AssignState>;
}) {
  const [state, formAction, pending] = useActionState(assignAction, {});

  if (availableProjects.length === 0) {
    return (
      <p className="text-sm text-zinc-400">
        All active projects are already assigned.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex items-end gap-2">
      <div className="flex-1">
        <label htmlFor={`proj-select-${subOrgId}`} className="mb-1 block text-xs text-zinc-500">
          Add to project
        </label>
        <select
          id={`proj-select-${subOrgId}`}
          name="projectId"
          defaultValue=""
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        >
          <option value="" disabled>Select project…</option>
          {availableProjects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "Adding…" : "Add to project"}
      </button>
      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
