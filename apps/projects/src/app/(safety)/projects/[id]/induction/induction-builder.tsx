"use client";

import { useActionState, useState } from "react";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;

type Question = {
  question: string;
  options: string[];
  correctAnswers: number[];
};

export type InductionBuilderState = { error?: string; success?: boolean };

function normalizeQuestion(q: unknown): Question {
  const raw = q as Record<string, unknown>;
  const options = Array.isArray(raw.options) ? (raw.options as string[]) : ["", ""];
  let correctAnswers: number[];
  if (Array.isArray(raw.correctAnswers)) {
    correctAnswers = raw.correctAnswers as number[];
  } else if (typeof raw.correctAnswer === "number") {
    correctAnswers = [raw.correctAnswer];
  } else {
    correctAnswers = [];
  }
  return {
    question: typeof raw.question === "string" ? raw.question : "",
    options,
    correctAnswers,
  };
}

export function InductionBuilder({
  saveAction,
  initialTitle,
  initialQuestions,
  initialVideoUrl,
}: {
  saveAction: (prev: InductionBuilderState, fd: FormData) => Promise<InductionBuilderState>;
  initialTitle?: string;
  initialQuestions?: unknown[];
  initialVideoUrl?: string;
}) {
  const [state, action, pending] = useActionState(saveAction, {});
  const [questions, setQuestions] = useState<Question[]>(
    (initialQuestions ?? []).map(normalizeQuestion),
  );

  function addQuestion() {
    setQuestions((q) => [
      ...q,
      { question: "", options: ["", ""], correctAnswers: [] },
    ]);
  }

  function removeQuestion(i: number) {
    setQuestions((q) => q.filter((_, idx) => idx !== i));
  }

  function updateQuestionText(i: number, value: string) {
    setQuestions((q) =>
      q.map((item, idx) => (idx === i ? { ...item, question: value } : item)),
    );
  }

  function addOption(qi: number) {
    setQuestions((q) =>
      q.map((item, idx) => {
        if (idx !== qi || item.options.length >= MAX_OPTIONS) return item;
        return { ...item, options: [...item.options, ""] };
      }),
    );
  }

  function removeOption(qi: number, oi: number) {
    setQuestions((q) =>
      q.map((item, idx) => {
        if (idx !== qi || item.options.length <= MIN_OPTIONS) return item;
        const options = item.options.filter((_, i) => i !== oi);
        const correctAnswers = item.correctAnswers
          .filter((ca) => ca !== oi)
          .map((ca) => (ca > oi ? ca - 1 : ca));
        return { ...item, options, correctAnswers };
      }),
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

  function toggleCorrectAnswer(qi: number, oi: number) {
    setQuestions((q) =>
      q.map((item, idx) => {
        if (idx !== qi) return item;
        const correctAnswers = item.correctAnswers.includes(oi)
          ? item.correctAnswers.filter((ca) => ca !== oi)
          : [...item.correctAnswers, oi].sort((a, b) => a - b);
        return { ...item, correctAnswers };
      }),
    );
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="questions" value={JSON.stringify(questions)} />

      {state.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200">
          Induction saved successfully.
        </p>
      )}

      <div>
        <label
          htmlFor="title"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Induction title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          defaultValue={initialTitle}
          required
          placeholder="e.g. Agero Safety Generic Induction 2025"
          className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
        />
      </div>

      <div>
        <label
          htmlFor="videoUrl"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Video URL{" "}
          <span className="font-normal text-zinc-400">(optional — YouTube or Vimeo)</span>
        </label>
        <input
          id="videoUrl"
          name="videoUrl"
          type="url"
          defaultValue={initialVideoUrl ?? ""}
          placeholder="https://www.youtube.com/watch?v=..."
          className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Workers will be shown this video before answering questions.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Questions ({questions.length})
          </h3>
          <button
            type="button"
            onClick={addQuestion}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            + Add question
          </button>
        </div>

        {questions.length === 0 && (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            No questions yet. Add at least one question before saving.
          </p>
        )}

        {questions.map((q, qi) => (
          <div
            key={qi}
            className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50"
          >
            {/* Question text */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={q.question}
                  onChange={(e) => updateQuestionText(qi, e.target.value)}
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

            {/* Options */}
            <div className="mt-3 space-y-2">
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={q.correctAnswers.includes(oi)}
                    onChange={() => toggleCorrectAnswer(qi, oi)}
                    className="h-4 w-4 flex-shrink-0 accent-green-600"
                    title="Mark as correct answer"
                  />
                  <span className="w-5 flex-shrink-0 text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                    {LETTERS[oi]}
                  </span>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => updateOption(qi, oi, e.target.value)}
                    placeholder={`Option ${LETTERS[oi]}${q.correctAnswers.includes(oi) ? " (correct)" : ""}`}
                    className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                  {q.options.length > MIN_OPTIONS && (
                    <button
                      type="button"
                      onClick={() => removeOption(qi, oi)}
                      className="flex-shrink-0 text-xs text-red-400 hover:text-red-600"
                      title="Remove option"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Footer: add option + correct answer indicator */}
            <div className="mt-3 flex items-center gap-4">
              {q.options.length < MAX_OPTIONS && (
                <button
                  type="button"
                  onClick={() => addOption(qi)}
                  className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  + Add option
                </button>
              )}
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                {q.correctAnswers.length === 0 ? (
                  <span className="text-amber-500">☐ Check the correct answer(s)</span>
                ) : q.correctAnswers.length === 1 ? (
                  `✓ Correct: ${LETTERS[q.correctAnswers[0]]}`
                ) : (
                  `✓ Correct: ${q.correctAnswers.map((ca) => LETTERS[ca]).join(", ")} (select all)`
                )}
              </p>
            </div>
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
