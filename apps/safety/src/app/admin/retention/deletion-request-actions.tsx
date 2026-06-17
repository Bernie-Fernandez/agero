"use client";

import { useTransition } from "react";
import { approveDeletionRequest, rejectDeletionRequest } from "./actions";

export function DeletionRequestActions({ requestId }: { requestId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleApprove() {
    if (
      !confirm(
        "Approve deletion request?\n\nThis anonymises the worker's personal information now. Site visit timestamps are retained for the OHS audit trail. This cannot be undone.",
      )
    )
      return;
    startTransition(async () => {
      const r = await approveDeletionRequest(requestId);
      if (r.error) alert(r.error);
    });
  }

  function handleReject() {
    startTransition(async () => {
      const r = await rejectDeletionRequest(requestId);
      if (r.error) alert(r.error);
    });
  }

  return (
    <div className="flex shrink-0 gap-2">
      <button
        type="button"
        onClick={handleReject}
        disabled={isPending}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Reject
      </button>
      <button
        type="button"
        onClick={handleApprove}
        disabled={isPending}
        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {isPending ? "Processing…" : "Approve & anonymise"}
      </button>
    </div>
  );
}
