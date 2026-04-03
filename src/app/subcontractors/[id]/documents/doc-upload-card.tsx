"use client";

import { useActionState } from "react";
import type { DocUploadState } from "./actions";
import type { RagStatus } from "@/lib/compliance";
import { ComplianceBadge } from "@/components/compliance-badge";

export function DocUploadCard({
  label,
  docType,
  status,
  reasons,
  currentUrl,
  currentExpiry,
  daysUntilExpiry,
  aiExtracted,
  coverageAmount,
  showCoverage,
  uploadAction,
}: {
  label: string;
  docType: string;
  status: RagStatus;
  reasons: string[];
  currentUrl?: string;
  currentExpiry?: Date | null;
  daysUntilExpiry?: number | null;
  aiExtracted?: boolean;
  coverageAmount?: string | null;
  showCoverage?: boolean;
  uploadAction: (prev: DocUploadState, fd: FormData) => Promise<DocUploadState>;
}) {
  const [state, action, pending] = useActionState(uploadAction, {});

  const daysUntil = daysUntilExpiry ?? null;

  return (
    <div className={`rounded-xl border bg-white dark:bg-zinc-900 ${
      status === "red" ? "border-red-200 dark:border-red-900" :
      status === "amber" ? "border-amber-200 dark:border-amber-900" :
      "border-zinc-200 dark:border-zinc-800"
    }`}>
      <div className="flex items-start justify-between px-5 py-4">
        <div>
          <p className="font-medium text-zinc-900 dark:text-zinc-50">{label}</p>
          {currentUrl ? (
            <div className="mt-1 space-y-0.5">
              <a href={currentUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline dark:text-blue-400">
                View document →
              </a>
              {currentExpiry && (
                <p className="text-xs text-zinc-500">
                  Expires {new Date(currentExpiry).toLocaleDateString("en-AU")}
                  {daysUntil !== null && daysUntil >= 0 && (
                    <span className={`ml-1 ${daysUntil <= 7 ? "text-red-600" : daysUntil <= 30 ? "text-amber-600" : "text-zinc-400"}`}>
                      ({daysUntil}d)
                    </span>
                  )}
                  {aiExtracted && (
                    <span className="ml-1 text-blue-500" title="Expiry date was extracted by AI">AI</span>
                  )}
                </p>
              )}
              {coverageAmount && (
                <p className="text-xs text-zinc-500">Coverage: {coverageAmount}</p>
              )}
            </div>
          ) : (
            <p className="mt-1 text-xs text-red-500">Not uploaded</p>
          )}
        </div>
        <ComplianceBadge status={status} reasons={reasons} />
      </div>

      <div className="border-t border-zinc-100 px-5 py-4 dark:border-zinc-800">
        <form action={action} className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-48">
              <label className="block text-xs text-zinc-500 mb-1">
                {currentUrl ? "Replace document" : "Upload document"} (PDF/image, max 20MB)
              </label>
              <input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="block w-full text-xs text-zinc-600 file:mr-2 file:rounded file:border-0 file:bg-zinc-100 file:px-2 file:py-1 file:text-xs file:font-medium hover:file:bg-zinc-200 dark:text-zinc-400 dark:file:bg-zinc-700 dark:file:text-zinc-300" />
            </div>
            {docType !== "whs_policy" && (
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Expiry date</label>
                <input type="date" name="expiryDate"
                  defaultValue={currentExpiry ? new Date(currentExpiry).toISOString().split("T")[0] : undefined}
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50" />
              </div>
            )}
            {showCoverage && (
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Coverage amount</label>
                <input type="text" name="coverageAmount" defaultValue={coverageAmount ?? ""}
                  placeholder="e.g. $20,000,000"
                  className="w-36 rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50" />
              </div>
            )}
          </div>

          {state.error && <p className="text-xs text-red-600">{state.error}</p>}
          {state.success && (
            <p className="text-xs text-green-600">
              Uploaded.{" "}
              {state.aiDate
                ? `AI extracted expiry: ${state.aiDate} (${state.aiConfidence} confidence) — please verify.`
                : state.aiConfidence === undefined && docType !== "whs_policy"
                ? "Please enter the expiry date."
                : ""}
            </p>
          )}

          <button type="submit" disabled={pending}
            className="rounded bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-200 dark:text-zinc-900">
            {pending ? "Uploading…" : "Upload"}
          </button>
        </form>
      </div>
    </div>
  );
}
