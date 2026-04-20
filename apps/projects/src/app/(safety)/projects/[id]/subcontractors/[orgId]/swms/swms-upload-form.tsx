"use client";

import { useActionState } from "react";
import type { SwmsUploadState } from "./actions";

export function SwmsUploadForm({
  uploadAction,
}: {
  uploadAction: (prev: SwmsUploadState, fd: FormData) => Promise<SwmsUploadState>;
}) {
  const [state, action, pending] = useActionState(uploadAction, {});

  return (
    <form action={action} className="flex items-end gap-3 flex-wrap">
      <div className="flex-1 min-w-56">
        <label className="block text-xs text-zinc-500 mb-1">PDF file (max 50 MB)</label>
        <input type="file" name="file" accept=".pdf"
          className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-zinc-200 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-300" />
        {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      </div>
      <button type="submit" disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Uploading & scanning…" : "Upload SWMS for review"}
      </button>
    </form>
  );
}
