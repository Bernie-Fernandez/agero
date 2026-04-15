"use client";

import { useActionState } from "react";
import type { SwmsQuestionActionState } from "./actions";

// Mirror of the Prisma enum — kept local to avoid importing node:module in a client bundle
type SwmsQuestionStatus = "pending_review" | "approved" | "rejected";
const SwmsQuestionStatus = {
  pending_review: "pending_review" as SwmsQuestionStatus,
  approved: "approved" as SwmsQuestionStatus,
  rejected: "rejected" as SwmsQuestionStatus,
};

type ReviewQuestion = {
  id: string;
  question: string;
  expectedAnswerContext: string;
  status: SwmsQuestionStatus;
};

export function SwmsQuestionReviewList({
  projectId,
  questions,
  reviewAction,
}: {
  projectId: string;
  questions: ReviewQuestion[];
  reviewAction: (
    questionId: string,
    status: SwmsQuestionStatus,
    prev: SwmsQuestionActionState,
    formData: FormData,
  ) => Promise<SwmsQuestionActionState>;
}) {
  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {questions.map((q) => (
        <QuestionRow key={q.id} question={q} reviewAction={reviewAction} projectId={projectId} />
      ))}
    </ul>
  );
}

function QuestionRow({
  question: q,
  reviewAction,
}: {
  projectId: string;
  question: ReviewQuestion;
  reviewAction: (
    questionId: string,
    status: SwmsQuestionStatus,
    prev: SwmsQuestionActionState,
    formData: FormData,
  ) => Promise<SwmsQuestionActionState>;
}) {
  const approveAction = reviewAction.bind(null, q.id, SwmsQuestionStatus.approved);
  const rejectAction = reviewAction.bind(null, q.id, SwmsQuestionStatus.rejected);

  const [approveState, approve, approvePending] = useActionState(approveAction, {});
  const [rejectState, reject, rejectPending] = useActionState(rejectAction, {});

  const pending = approvePending || rejectPending;
  const error = approveState.error ?? rejectState.error;

  return (
    <li className="px-5 py-4">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{q.question}</p>
          {q.expectedAnswerContext && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-medium">Expected: </span>
              {q.expectedAnswerContext}
            </p>
          )}
          {error && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {q.status === SwmsQuestionStatus.approved ? (
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
              Approved
            </span>
          ) : q.status === SwmsQuestionStatus.rejected ? (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
              Rejected
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              Pending
            </span>
          )}

          {q.status !== SwmsQuestionStatus.approved && (
            <form action={approve}>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg border border-green-300 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950/30"
              >
                Approve
              </button>
            </form>
          )}

          {q.status !== SwmsQuestionStatus.rejected && (
            <form action={reject}>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                Reject
              </button>
            </form>
          )}
        </div>
      </div>
    </li>
  );
}
