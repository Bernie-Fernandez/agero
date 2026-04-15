"use client";

import { useActionState, useRef } from "react";
import { uploadCertDocument } from "./actions";
import type { CertUploadState } from "./actions";

const DOC_TYPES = [
  { value: "white_card", label: "White card" },
  { value: "trade_licence", label: "Trade licence" },
  { value: "first_aid", label: "First aid certificate" },
  { value: "other", label: "Other" },
];

export function CertUpload() {
  const [state, action, pending] = useActionState<CertUploadState, FormData>(
    uploadCertDocument,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      {state.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200">
          {state.success}
        </p>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Document type
        </label>
        <select
          name="docType"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
        >
          {DOC_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          File (image or PDF, max 10 MB)
        </label>
        <input
          name="file"
          type="file"
          accept="image/*,.pdf"
          required
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 file:mr-3 file:rounded file:border-0 file:bg-zinc-100 file:px-3 file:py-1 file:text-xs file:font-medium dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
        />
        {process.env.NODE_ENV !== "production" && (
          <p className="mt-1 text-xs text-zinc-400">
            AI will auto-extract expiry dates from image files.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "Uploading…" : "Upload document"}
      </button>
    </form>
  );
}
