"use client";

import { useActionState, useRef } from "react";
import type { FloorPlanState } from "./floor-plan-actions";

interface Props {
  uploadAction: (prev: FloorPlanState, fd: FormData) => Promise<FloorPlanState>;
  existingFileUrl?: string | null;
  existingFileName?: string | null;
  uploadedBy?: string | null;
  uploadedAt?: Date | null;
}

export function FloorPlanForm({ uploadAction, existingFileUrl, existingFileName, uploadedBy, uploadedAt }: Props) {
  const [state, action, pending] = useActionState(uploadAction, {});
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      {existingFileUrl && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/50">
          <div>
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{existingFileName ?? "Floor plan"}</p>
            {uploadedBy && uploadedAt && (
              <p className="mt-0.5 text-xs text-zinc-500">
                Uploaded by {uploadedBy} · {new Date(uploadedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            )}
          </div>
          <a
            href={existingFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            View →
          </a>
        </div>
      )}

      <form action={action} className="flex items-end gap-3 flex-wrap">
        {state.error && (
          <p className="w-full text-xs text-red-600 dark:text-red-400">{state.error}</p>
        )}
        {state.success && (
          <p className="w-full text-xs text-green-600 dark:text-green-400">Floor plan uploaded.</p>
        )}
        <label className="block flex-1">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {existingFileUrl ? "Replace floor plan" : "Upload floor plan"} (JPEG, PNG, WebP, or PDF · max 20 MB)
          </span>
          <input
            ref={fileRef}
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            required
            className="mt-1 block w-full text-sm text-zinc-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-300"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Uploading…" : "Upload"}
        </button>
      </form>
    </div>
  );
}
