"use client";

import { useActionState, useState } from "react";
import type { InductionFormState } from "./actions";

type Question = {
  question: string;
  options: string[];
  correctAnswer: number;
};

export function InductionBuilder({
  saveAction,
  initialTitle,
  initialQuestions,
}: {
  saveAction: (prev: InductionFormState, fd: FormData) => Promise<InductionFormState>;
  initialTitle?: string;
  initialQuestions?: Question[];
}) {
  const [state, action, pending] = useActionState(saveAction, {});
  const [questions, setQuestions] = useState<Question[]>(
    initialQuestions ?? [],
  );

  function addQuestion() {
    setQuestions((q) => [
      ...q,
      { question: "", options: ["", "", "", ""], correctAnswer: 0 },
    ]);
  }

  function removeQuestion(i: number) {
    setQuestions((q) => q.filter((_, idx) => idx !== i));
  }

  function updateQuestion(i: number, field: keyof Question, value: unknown) {
    setQuestions((q) =>
      q.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)),
    );
  }

  function updateOption(qi: number, oi: number, value: string) {
    setQuestions((q) =>
      q.map((item, idx) => {
        if (idx !== qi) return item;
        const options = [...item.options];
        options[oi] = value;
        return { ...item, options };
      }),
    );
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="questions" value={JSON.stringify(questions)} />

      {state.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Induction saved successfully.</p>
      )}

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Induction title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          defaultValue={initialTitle}
          required
          placeholder="e.g. Collins St Tower Site Induction"
          className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Questions ({questions.length})</h3>
          <button
            type="button"
            onClick={addQuestion}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            + Add question
          </button>
        </div>

        {questions.map((q, qi) => (
          <div key={qi} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={q.question}
                  onChange={(e) => updateQuestion(qi, "question", e.target.value)}
                  placeholder={`Question ${qi + 1}`}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </div>
              <button
                type="button"
                onClick={() => removeQuestion(qi)}
                className="mt-1 text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${qi}`}
                    checked={q.correctAnswer === oi}
                    onChange={() => updateQuestion(qi, "correctAnswer", oi)}
                    className="accent-green-600"
                    title="Mark as correct answer"
                  />
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => updateOption(qi, oi, e.target.value)}
                    placeholder={`Option ${oi + 1}${q.correctAnswer === oi ? " (correct)" : ""}`}
                    className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-zinc-400">Select the radio button next to the correct answer</p>
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Saving…" : "Save induction"}
      </button>
    </form>
  );
}
