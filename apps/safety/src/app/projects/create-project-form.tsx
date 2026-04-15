"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createProject, type ProjectFormState } from "./actions";

const initial: ProjectFormState = {};

export function CreateProjectForm() {
  const [state, action, pending] = useActionState(createProject, initial);

  if (state.projectId) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5 dark:border-green-800 dark:bg-green-950/30">
        <p className="font-medium text-green-800 dark:text-green-300">Project created!</p>
        <p className="mt-1 text-sm text-green-700 dark:text-green-400 mb-3">
          Complete these steps to get your project ready:
        </p>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-4 w-4 rounded-full border-2 border-green-400 shrink-0" />
            <Link href={`/projects/${state.projectId}/induction`} className="text-green-700 hover:underline dark:text-green-400">
              Set up site induction &amp; upload SWMS →
            </Link>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-4 w-4 rounded-full border-2 border-green-400 shrink-0" />
            <Link href="/subcontractors/new" className="text-green-700 hover:underline dark:text-green-400">
              Invite subcontractors →
            </Link>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-4 w-4 rounded-full border-2 border-green-400 shrink-0" />
            <Link href={`/projects/${state.projectId}`} className="text-green-700 hover:underline dark:text-green-400">
              Print site QR code →
            </Link>
          </li>
        </ul>
        <div className="mt-4">
          <Link
            href={`/projects/${state.projectId}`}
            className="rounded-lg bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800"
          >
            Open project →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="startDate" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
            Start date
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-zinc-500"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="endDate" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
            End date
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-zinc-500"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {pending ? "Creating…" : "Create project"}
          </button>
        </div>
      </div>
    </form>
  );
}
