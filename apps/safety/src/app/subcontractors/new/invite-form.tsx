"use client";

import { useActionState } from "react";
import { sendInvitation, type InviteState } from "./actions";
import { TRADE_CATEGORIES } from "@/lib/trade-categories";

const initial: InviteState = {};

export function InviteForm({ projects }: { projects: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(sendInvitation, initial);

  if (state.success) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-950/30">
        <p className="font-medium text-green-800 dark:text-green-300">Invitation sent</p>
        <p className="mt-1 text-sm text-green-700 dark:text-green-400">
          The subcontractor will receive an email with a registration link valid for 14 days.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4 max-w-lg">
      {state.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>
      )}
      <div>
        <label htmlFor="companyName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Company name <span className="text-red-500">*</span>
        </label>
        <input id="companyName" name="companyName" type="text" required placeholder="e.g. Smith Electrical Pty Ltd"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50" />
      </div>
      <div>
        <label htmlFor="contactName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Primary contact name <span className="text-red-500">*</span>
        </label>
        <input id="contactName" name="contactName" type="text" required placeholder="e.g. Jane Smith"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50" />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Contact email <span className="text-red-500">*</span>
          <span className="ml-1.5 text-xs font-normal text-zinc-400">(registration link is sent here)</span>
        </label>
        <input id="email" name="email" type="email" required placeholder="jane@smithelectrical.com.au"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50" />
      </div>
      <div>
        <label htmlFor="mobile" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Contact mobile</label>
        <input id="mobile" name="mobile" type="tel" placeholder="04XX XXX XXX"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50" />
      </div>

      {/* Trade categories */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Trade categories
          <span className="ml-1.5 text-xs font-normal text-zinc-400">(select all that apply)</span>
        </label>
        <div className="flex flex-wrap gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
          {TRADE_CATEGORIES.map((cat) => (
            <label key={cat} className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                name="tradeCategories"
                value={cat}
                className="h-3.5 w-3.5 rounded border-zinc-300 accent-zinc-900 dark:accent-zinc-100"
              />
              <span className="text-xs text-zinc-600 dark:text-zinc-400">{cat}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Project assignment */}
      {projects.length > 0 && (
        <div>
          <label htmlFor="projectId" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Assign to project
            <span className="ml-1.5 text-xs font-normal text-zinc-400">(optional)</span>
          </label>
          <select id="projectId" name="projectId"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50">
            <option value="">— No project —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      <button type="submit" disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Sending…" : "Send invitation"}
      </button>
    </form>
  );
}
