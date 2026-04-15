"use client";

import { useActionState } from "react";
import type { DocState } from "./actions";

export function DocUploadForm({
  uploadAction,
  label,
  currentUrl,
  currentExpiry,
}: {
  uploadAction: (prev: DocState, fd: FormData) => Promise<DocState>;
  label: string;
  currentUrl?: string;
  currentExpiry?: Date | null;
}) {
  const [state, action, pending] = useActionState(uploadAction, {});

  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
      <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">{label}</p>
      {currentUrl && (
        <p className="mb-2 text-xs text-zinc-500">
          <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            View current →
          </a>
          {currentExpiry && (
            <span className="ml-2">
              Expires {new Date(currentExpiry).toLocaleDateString("en-AU")}
            </span>
          )}
        </p>
      )}
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="file" name="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          className="block text-xs text-zinc-600 file:mr-2 file:rounded file:border-0 file:bg-zinc-200 file:px-2 file:py-1 file:text-xs file:font-medium hover:file:bg-zinc-300 dark:text-zinc-400 dark:file:bg-zinc-700 dark:file:text-zinc-300" />
        <div>
          <label className="block text-xs text-zinc-500 mb-0.5">Expiry date</label>
          <input type="date" name="expiryDate"
            defaultValue={currentExpiry ? new Date(currentExpiry).toISOString().split("T")[0] : undefined}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50" />
        </div>
        <button type="submit" disabled={pending}
          className="rounded bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-200 dark:text-zinc-900">
          {pending ? "…" : "Upload"}
        </button>
        {state.error && <p className="w-full text-xs text-red-600">{state.error}</p>}
        {state.success && <p className="w-full text-xs text-green-600">Uploaded.</p>}
      </form>
    </div>
  );
}
