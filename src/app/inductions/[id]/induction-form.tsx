"use client";

import { useActionState } from "react";
import type { InductionSubmitState } from "./actions";

type Question = {
  question: string;
  options: string[];
  correctAnswer: number;
};

export function InductionForm({
  questions,
  submitAction,
}: {
  questions: Question[];
  submitAction: (prev: InductionSubmitState, fd: FormData) => Promise<InductionSubmitState>;
}) {
  const [state, action, pending] = useActionState(submitAction, {});

  if (state.passed !== undefined) {
    return (
      <div className={`rounded-xl border p-8 text-center ${state.passed
        ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
        : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
      }`}>
        <p className={`text-3xl font-bold ${state.passed ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
          {state.passed ? "✓ Passed" : "✗ Not passed"}
        </p>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          You scored {state.score}% ({state.score !== undefined && state.total !== undefined
            ? `${Math.round(state.score / 100 * state.total)}/${state.total}`
            : ""} correct)
        </p>
        {!state.passed && (
          <p className="mt-3 text-sm text-zinc-500">You need 80% to pass. Please read the questions carefully and try again.</p>
        )}
        {state.passed && (
          <p className="mt-3 text-sm text-zinc-500">Your induction record has been saved. You may now sign in to site.</p>
        )}
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <p className="text-zinc-500">This induction has no questions yet. Check back soon.</p>
    );
  }

  return (
    <form action={action} className="space-y-6">
      {state.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>
      )}
      {questions.map((q, i) => (
        <fieldset key={i} className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
          <legend className="text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-3">
            {i + 1}. {q.question}
          </legend>
          <div className="space-y-2">
            {q.options.map((opt, oi) => (
              <label key={oi} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name={`q${i}`}
                  value={oi}
                  required
                  className="accent-zinc-800 dark:accent-zinc-200"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{opt}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Submitting…" : "Submit induction"}
      </button>
    </form>
  );
}
