"use client";

import { useActionState } from "react";
import type { SwmsUploadState } from "./actions";

interface Props {
  uploadAction: (prev: SwmsUploadState, fd: FormData) => Promise<SwmsUploadState>;
  defaultTradeCategory?: string;
}

export function SwmsUploadForm({ uploadAction, defaultTradeCategory }: Props) {
  const [state, action, pending] = useActionState(uploadAction, {});

  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="block">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Trade category <span className="text-red-500">*</span>
          </span>
          <input
            type="text"
            name="tradeCategory"
            defaultValue={defaultTradeCategory ?? ""}
            placeholder="e.g. Electrical, Plumbing, Demolition"
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
      </div>
      <div>
        <label className="block">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            SWMS document (PDF) <span className="text-red-500">*</span>
          </span>
          <input
            type="file"
            name="file"
            accept=".pdf"
            className="mt-1 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-300"
          />
        </label>
      </div>
      {state.error && (
        <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "Uploading…" : "Upload SWMS"}
      </button>
    </form>
  );
}
