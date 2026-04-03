"use client";

import { useActionState, useState } from "react";
import type { SwmsReviewState } from "./actions";
import type { SwmsReviewResult } from "@/lib/claude";

const CRITERIA_LABELS: Record<string, string> = {
  site_specific_details: "Site-specific details",
  contractor_details: "Contractor details",
  responsible_person: "Responsible person",
  scope_of_work: "Scope of work",
  competencies_training: "Competencies & training",
  steps_tasks: "Steps & tasks",
  hazards_risks: "Hazards & risks",
  control_measures: "Control measures",
  legislation_references: "Legislation references",
  emergency_procedures: "Emergency procedures",
  plant_equipment: "Plant & equipment",
  ppe_requirements: "PPE requirements",
  chemicals_msds: "Chemicals & MSDS",
  worker_signatures: "Worker signatures",
};

export function ReviewForm({
  submission,
  approveAction,
  rejectAction,
}: {
  submission: {
    id: string;
    status: string;
    aiScanResults: unknown;
    aiRecommendation: string | null;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    reviewerComments: string | null;
  };
  approveAction: (prev: SwmsReviewState, fd: FormData) => Promise<SwmsReviewState>;
  rejectAction: (prev: SwmsReviewState, fd: FormData) => Promise<SwmsReviewState>;
}) {
  const [approveState, approve, approvePending] = useActionState(approveAction, {});
  const [rejectState, reject, rejectPending] = useActionState(rejectAction, {});
  const [showRejectForm, setShowRejectForm] = useState(false);

  const ai = submission.aiScanResults as SwmsReviewResult | null;
  const isPending = submission.status === "pending_review";
  const isApproved = submission.status === "approved";
  const isRejected = submission.status === "rejected";

  return (
    <div className="space-y-6">
      {/* AI scan results */}
      {ai ? (
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
            <div>
              <h3 className="font-medium text-zinc-900 dark:text-zinc-50">AI scan results</h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                {ai.pass_count} pass · {ai.fail_count} fail · {ai.na_count} N/A
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${
              ai.overall_recommendation === "approve"
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
            }`}>
              AI recommends: {ai.overall_recommendation === "approve" ? "Approve" : "Reject"}
            </span>
          </div>

          {ai.summary_comments && (
            <div className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{ai.summary_comments}</p>
            </div>
          )}

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {Object.entries(ai.criteria).map(([key, val]) => (
              <div key={key} className="flex items-start gap-3 px-5 py-3">
                <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                  val.result === "pass" ? "bg-green-100 text-green-700" :
                  val.result === "fail" ? "bg-red-100 text-red-700" :
                  "bg-zinc-100 text-zinc-500"
                }`}>
                  {val.result === "pass" ? "✓ Pass" : val.result === "fail" ? "✗ Fail" : "N/A"}
                </span>
                <div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">{CRITERIA_LABELS[key] ?? key}</p>
                  {val.comment && <p className="mt-0.5 text-xs text-zinc-500">{val.comment}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-800/50">
          <p className="text-sm text-zinc-500">AI scan not available — add ANTHROPIC_API_KEY to enable automatic SWMS review.</p>
        </div>
      )}

      {/* Review actions */}
      {isPending && (
        <div className="flex items-start gap-3">
          {approveState.error && <p className="text-sm text-red-600">{approveState.error}</p>}
          {!showRejectForm ? (
            <>
              <form action={approve}>
                <button type="submit" disabled={approvePending}
                  className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60">
                  {approvePending ? "Approving…" : "Approve"}
                </button>
              </form>
              <button type="button" onClick={() => setShowRejectForm(true)}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700">
                Reject
              </button>
            </>
          ) : (
            <form action={reject} className="w-full space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Rejection comments (sent to subcontractor)
                </label>
                <textarea name="comments" required rows={4} placeholder="Describe what needs to be corrected before resubmission…"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-red-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50" />
                {rejectState.error && <p className="mt-1 text-xs text-red-600">{rejectState.error}</p>}
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={rejectPending}
                  className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">
                  {rejectPending ? "Rejecting…" : "Confirm rejection"}
                </button>
                <button type="button" onClick={() => setShowRejectForm(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {isApproved && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 dark:border-green-800 dark:bg-green-950/30">
          <p className="font-medium text-green-800 dark:text-green-300">Approved</p>
          <p className="mt-0.5 text-sm text-green-700 dark:text-green-400">
            Approved by {submission.reviewedBy} on {submission.reviewedAt ? new Date(submission.reviewedAt).toLocaleDateString("en-AU") : "—"}
          </p>
        </div>
      )}

      {isRejected && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 dark:border-red-800 dark:bg-red-950/30">
          <p className="font-medium text-red-800 dark:text-red-300">Rejected</p>
          <p className="mt-1 text-sm text-red-700 dark:text-red-400">{submission.reviewerComments}</p>
        </div>
      )}
    </div>
  );
}
