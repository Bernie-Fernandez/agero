"use client";

import { useActionState } from "react";
import type { InductionFormState } from "./actions";

export function SwmsUploadForm({
  uploadAction,
  currentUrl,
}: {
  uploadAction: (prev: InductionFormState, fd: FormData) => Promise<InductionFormState>;
  currentUrl?: string;
}) {
  const [state, action, pending] = useActionState(uploadAction, {});

  return (
    <form action={action} className="flex items-end gap-3">
      <div className="flex-1">
        {currentUrl && (
          <p className="mb-2 text-xs text-zinc-500">
            Current:{" "}
            <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              View document →
            </a>
          </p>
        )}
        <input
          type="file"
          name="file"
          accept=".pdf,.doc,.docx"
          className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-300"
        />
        {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
        {state.success && <p className="mt-1 text-xs text-green-600">Uploaded successfully.</p>}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Uploading…" : "Upload SWMS"}
      </button>
    </form>
  );
}
