"use client";

import { useActionState, useState } from "react";
import { requestDataDeletion, type DeletionRequestState } from "./deletion-actions";

interface Props {
  pending: boolean;
  pendingRequestedAt: string | null;
}

export function DataDeletion({ pending, pendingRequestedAt }: Props) {
  const [state, formAction, submitting] = useActionState<DeletionRequestState, FormData>(
    requestDataDeletion,
    {},
  );
  const [open, setOpen] = useState(false);

  const isPending = pending || state.ok;

  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div>
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Your data &amp; privacy</h2>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          You can request deletion of your personal information. Your request is sent to the Agero Director
          for approval. Site attendance records are retained in de-identified form as part of the legally
          required OHS audit trail.
        </p>
      </div>

      {isPending ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300">
          A data deletion request is pending Director review
          {pendingRequestedAt ? ` (submitted ${new Date(pendingRequestedAt).toLocaleDateString("en-AU")})` : ""}.
        </div>
      ) : open ? (
        <form action={formAction} className="space-y-2">
          {state.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-300">
              {state.error}
            </div>
          )}
          <textarea
            name="reason"
            rows={2}
            placeholder="Reason (optional)…"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit deletion request"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setOpen(true)} className="text-xs font-medium text-red-600 hover:underline dark:text-red-400">
          Request data deletion →
        </button>
      )}
    </section>
  );
}
