"use client";

import { useTransition } from "react";
import { anonymiseWorker, dismissRetentionFlag } from "./actions";

export function RetentionActions({
  flagId,
  workerName,
}: {
  flagId: string;
  workerName: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleAnonymise() {
    if (
      !confirm(
        `Anonymise ${workerName}?\n\nThis will permanently remove all personal information for this worker. Site visit timestamps are retained for the OHS audit trail.\n\nThis action cannot be undone.`,
      )
    )
      return;
    startTransition(async () => {
      const result = await anonymiseWorker(flagId);
      if (result.error) alert(result.error);
    });
  }

  function handleDismiss() {
    startTransition(async () => {
      const result = await dismissRetentionFlag(flagId);
      if (result.error) alert(result.error);
    });
  }

  return (
    <div className="flex shrink-0 gap-2">
      <button
        type="button"
        onClick={handleDismiss}
        disabled={isPending}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Dismiss
      </button>
      <button
        type="button"
        onClick={handleAnonymise}
        disabled={isPending}
        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {isPending ? "Processing…" : "Anonymise"}
      </button>
    </div>
  );
}
