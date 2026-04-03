"use client";

import { useActionState } from "react";
import { createProject, type ProjectFormState } from "./actions";

const initial: ProjectFormState = {};

export function CreateProjectForm() {
  const [state, action, pending] = useActionState(createProject, initial);

  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      {state.error && (
        <p className="col-span-full text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <div className="flex-1">
        <label htmlFor="name" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
          Project name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="e.g. 42 Collins St Tower"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none ring-zinc-400 placeholder:text-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-zinc-500"
        />
      </div>
      <div className="flex-1">
        <label htmlFor="address" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
          Address
        </label>
        <input
          id="address"
          name="address"
          type="text"
          placeholder="e.g. 42 Collins St, Melbourne VIC 3000"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none ring-zinc-400 placeholder:text-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-zinc-500"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}
