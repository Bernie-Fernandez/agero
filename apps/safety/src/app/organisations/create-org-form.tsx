"use client";

import { useActionState } from "react";
import { createOrganisation, type OrgFormState } from "./actions";

const initial: OrgFormState = {};

export function CreateOrgForm() {
  const [state, action, pending] = useActionState(createOrganisation, initial);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {state.error && (
        <p className="col-span-full text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <div>
        <label htmlFor="name" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
          Company name <span className="text-red-500">*</span>
        </label>
        <input id="name" name="name" type="text" required placeholder="e.g. Smith Electrical Pty Ltd"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50" />
      </div>
      <div>
        <label htmlFor="abn" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">ABN</label>
        <input id="abn" name="abn" type="text" inputMode="numeric" placeholder="51 824 753 556"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50" />
      </div>
      <div>
        <label htmlFor="tradeCategory" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Trade category</label>
        <input id="tradeCategory" name="tradeCategory" type="text" placeholder="e.g. Electrical"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50" />
      </div>
      <div>
        <label htmlFor="primaryContact" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Primary contact</label>
        <input id="primaryContact" name="primaryContact" type="text" placeholder="e.g. Jane Smith"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50" />
      </div>
      <div className="col-span-full">
        <button type="submit" disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900">
          {pending ? "Adding…" : "Add subcontractor"}
        </button>
      </div>
    </form>
  );
}
