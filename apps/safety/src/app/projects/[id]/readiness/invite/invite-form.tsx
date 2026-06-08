"use client";

import { useActionState } from "react";
import type { InviteState } from "./actions";

const initialState: InviteState = {};

type Org = { id: string; name: string; tradeCategory: string | null };

export function InviteForm({
  submitAction,
  orgs,
}: {
  submitAction: (prev: InviteState, formData: FormData) => Promise<InviteState>;
  orgs: Org[];
}) {
  const [state, formAction, pending] = useActionState(submitAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Subcontractor organisation
        </label>
        <select
          name="organisationId"
          required
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        >
          <option value="">Select organisation…</option>
          {orgs.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
              {org.tradeCategory ? ` — ${org.tradeCategory}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Mobile numbers
        </label>
        <p className="mt-0.5 text-xs text-zinc-500">
          One number per line (e.g. 0412 345 678). Up to 20 per batch.
        </p>
        <textarea
          name="mobiles"
          rows={5}
          required
          placeholder={"0412345678\n0423456789"}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 placeholder-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || orgs.length === 0}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send invitations"}
      </button>
    </form>
  );
}
