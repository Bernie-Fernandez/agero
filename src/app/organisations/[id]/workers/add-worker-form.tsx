"use client";

import { useActionState } from "react";
import type { WorkerFormState } from "./actions";

export function AddWorkerForm({
  addAction,
  projects,
}: {
  addAction: (prev: WorkerFormState, fd: FormData) => Promise<WorkerFormState>;
  projects: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(addAction, {});

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {state.error && (
        <p className="col-span-full text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <div>
        <label htmlFor="firstName" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">First name *</label>
        <input id="firstName" name="firstName" type="text" required placeholder="Jane"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50" />
      </div>
      <div>
        <label htmlFor="lastName" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Last name *</label>
        <input id="lastName" name="lastName" type="text" required placeholder="Smith"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50" />
      </div>
      <div>
        <label htmlFor="mobile" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Mobile</label>
        <input id="mobile" name="mobile" type="tel" placeholder="04XX XXX XXX"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50" />
      </div>
      <div>
        <label htmlFor="email" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Email</label>
        <input id="email" name="email" type="email" placeholder="jane@example.com"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50" />
      </div>
      <div>
        <label htmlFor="trade" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Trade</label>
        <input id="trade" name="trade" type="text" placeholder="e.g. Electrician"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50" />
      </div>
      <div>
        <label htmlFor="projectId" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Assign to project *</label>
        <select id="projectId" name="projectId" required
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50">
          <option value="">Select a project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <div className="col-span-full">
        <button type="submit" disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900">
          {pending ? "Adding…" : "Add worker"}
        </button>
      </div>
    </form>
  );
}
