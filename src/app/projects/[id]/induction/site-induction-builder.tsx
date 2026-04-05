"use client";

import { useActionState, useState } from "react";
import type { InductionFormState } from "./actions";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;

// ── Question types ──────────────────────────────────────────────────────────

type MultipleChoiceQuestion = {
  type: "multiple_choice";
  question: string;
  options: string[];
  correctAnswers: number[];
  isRisk: boolean;
  riskAddedAt?: string; // ISO date — set when question first added as risk update
};

type ShortAnswerQuestion = {
  type: "short_answer";
  question: string;
  expectedAnswerContext: string; // site manager only, never shown to worker
  isRisk: boolean;
  riskAddedAt?: string;
};

export type SiteQuestion = MultipleChoiceQuestion | ShortAnswerQuestion;

function normalizeQuestion(raw: unknown): SiteQuestion {
  const r = raw as Record<string, unknown>;
  const isRisk = typeof r.isRisk === "boolean" ? r.isRisk : false;
  const riskAddedAt = typeof r.riskAddedAt === "string" ? r.riskAddedAt : undefined;
  const question = typeof r.question === "string" ? r.question : "";

  if (r.type === "short_answer") {
    return {
      type: "short_answer",
      question,
      expectedAnswerContext:
        typeof r.expectedAnswerContext === "string" ? r.expectedAnswerContext : "",
      isRisk,
      riskAddedAt,
    };
  }

  // Default: multiple_choice — handles legacy format (no type field)
  const options = Array.isArray(r.options) ? (r.options as string[]) : ["", ""];
  let correctAnswers: number[];
  if (Array.isArray(r.correctAnswers)) {
    correctAnswers = r.correctAnswers as number[];
  } else if (typeof r.correctAnswer === "number") {
    correctAnswers = [r.correctAnswer];
  } else {
    correctAnswers = [];
  }
  return { type: "multiple_choice", question, options, correctAnswers, isRisk, riskAddedAt };
}

function formatRiskDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Component ────────────────────────────────────────────────────────────────

const DEFAULT_STANDARD_QUESTIONS: SiteQuestion[] = [
  { type: "short_answer", question: "Who is your Agero site supervisor and their phone number?", expectedAnswerContext: "", isRisk: false },
  { type: "short_answer", question: "Where is the first aid box on this site?", expectedAnswerContext: "", isRisk: false },
  { type: "short_answer", question: "Where are the toilets you are permitted to use?", expectedAnswerContext: "", isRisk: false },
  { type: "short_answer", question: "What are the emergency evacuation procedures for this site?", expectedAnswerContext: "", isRisk: false },
  { type: "short_answer", question: "Where is the site waste disposal area?", expectedAnswerContext: "", isRisk: false },
];

export function SiteInductionBuilder({
  saveAction,
  nextTitle,
  initialQuestions,
  initialVideoUrl,
}: {
  saveAction: (prev: InductionFormState, fd: FormData) => Promise<InductionFormState>;
  /** Pre-computed display title — the server will generate the same string on save. */
  nextTitle: string;
  initialQuestions?: unknown[];
  initialVideoUrl?: string;
}) {
  const [state, action, pending] = useActionState(saveAction, {});
  const [questions, setQuestions] = useState<SiteQuestion[]>(
    initialQuestions && initialQuestions.length > 0
      ? initialQuestions.map(normalizeQuestion)
      : DEFAULT_STANDARD_QUESTIONS,
  );

  // ── Mutation helpers ───────────────────────────────────────────────────────

  function addQuestion(isRisk: boolean) {
    setQuestions((q) => [
      ...q,
      {
        type: "short_answer",
        question: "",
        expectedAnswerContext: "",
        isRisk,
        riskAddedAt: isRisk ? new Date().toISOString() : undefined,
      },
    ]);
  }

  function removeQuestion(i: number) {
    setQuestions((q) => q.filter((_, idx) => idx !== i));
  }

  function setQuestionType(i: number, type: "multiple_choice" | "short_answer") {
    setQuestions((q) =>
      q.map((item, idx) => {
        if (idx !== i || item.type === type) return item;
        if (type === "short_answer") {
          return {
            type: "short_answer",
            question: item.question,
            expectedAnswerContext: "",
            isRisk: item.isRisk,
            riskAddedAt: item.riskAddedAt,
          };
        }
        return {
          type: "multiple_choice",
          question: item.question,
          options: ["", ""],
          correctAnswers: [],
          isRisk: item.isRisk,
          riskAddedAt: item.riskAddedAt,
        };
      }),
    );
  }

  function updateQuestionText(i: number, value: string) {
    setQuestions((q) =>
      q.map((item, idx) => (idx === i ? { ...item, question: value } : item)),
    );
  }

  function updateExpectedContext(i: number, value: string) {
    setQuestions((q) =>
      q.map((item, idx) => {
        if (idx !== i || item.type !== "short_answer") return item;
        return { ...item, expectedAnswerContext: value };
      }),
    );
  }

  function addOption(qi: number) {
    setQuestions((q) =>
      q.map((item, idx) => {
        if (idx !== qi || item.type !== "multiple_choice" || item.options.length >= MAX_OPTIONS)
          return item;
        return { ...item, options: [...item.options, ""] };
      }),
    );
  }

  function removeOption(qi: number, oi: number) {
    setQuestions((q) =>
      q.map((item, idx) => {
        if (idx !== qi || item.type !== "multiple_choice" || item.options.length <= MIN_OPTIONS)
          return item;
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
        if (idx !== qi || item.type !== "multiple_choice") return item;
        const options = [...item.options];
        options[oi] = value;
        return { ...item, options };
      }),
    );
  }

  function toggleCorrectAnswer(qi: number, oi: number) {
    setQuestions((q) =>
      q.map((item, idx) => {
        if (idx !== qi || item.type !== "multiple_choice") return item;
        const correctAnswers = item.correctAnswers.includes(oi)
          ? item.correctAnswers.filter((ca) => ca !== oi)
          : [...item.correctAnswers, oi].sort((a, b) => a - b);
        return { ...item, correctAnswers };
      }),
    );
  }

  // ── Render a single question card ──────────────────────────────────────────

  function renderQuestion(q: SiteQuestion, i: number, displayIndex: number) {
    return (
      <div
        key={i}
        className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50"
      >
        {/* Header row */}
        <div className="mb-3 flex items-center gap-2">
          <span className="w-5 flex-shrink-0 text-xs font-semibold text-zinc-400">
            {displayIndex}.
          </span>
          {q.isRisk && q.riskAddedAt && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              Risk update — {formatRiskDate(q.riskAddedAt)}
            </span>
          )}
          <div className="flex-1" />
          <select
            value={q.type}
            onChange={(e) =>
              setQuestionType(i, e.target.value as "multiple_choice" | "short_answer")
            }
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <option value="multiple_choice">Multiple choice</option>
            <option value="short_answer">Short answer</option>
          </select>
          <button
            type="button"
            onClick={() => removeQuestion(i)}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Remove
          </button>
        </div>

        {/* Question text */}
        <input
          type="text"
          value={q.question}
          onChange={(e) => updateQuestionText(i, e.target.value)}
          placeholder={`Question ${displayIndex}`}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
        />

        {/* Type-specific fields */}
        {q.type === "short_answer" ? (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Expected answer context{" "}
              <span className="font-normal text-zinc-400 dark:text-zinc-500">
                — visible to you only, never shown to workers
              </span>
            </label>
            <textarea
              value={q.expectedAnswerContext}
              onChange={(e) => updateExpectedContext(i, e.target.value)}
              placeholder="Describe what an acceptable answer should demonstrate..."
              rows={3}
              className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {q.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={q.correctAnswers.includes(oi)}
                  onChange={() => toggleCorrectAnswer(i, oi)}
                  className="h-4 w-4 flex-shrink-0 accent-green-600"
                  title="Mark as correct answer"
                />
                <span className="w-5 flex-shrink-0 text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                  {LETTERS[oi]}
                </span>
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => updateOption(i, oi, e.target.value)}
                  placeholder={`Option ${LETTERS[oi]}${q.correctAnswers.includes(oi) ? " (correct)" : ""}`}
                  className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                />
                {q.options.length > MIN_OPTIONS && (
                  <button
                    type="button"
                    onClick={() => removeOption(i, oi)}
                    className="flex-shrink-0 text-xs text-red-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <div className="mt-1 flex items-center gap-4">
              {q.options.length < MAX_OPTIONS && (
                <button
                  type="button"
                  onClick={() => addOption(i)}
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
        )}
      </div>
    );
  }

  // ── Split questions into sections ─────────────────────────────────────────

  const standard = questions.map((q, i) => ({ q, i })).filter(({ q }) => !q.isRisk);
  const risk = questions.map((q, i) => ({ q, i })).filter(({ q }) => q.isRisk);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="questions" value={JSON.stringify(questions)} />

      {state.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200">
          Induction published successfully.
        </p>
      )}

      {/* Auto-computed title preview */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Will be published as
        </p>
        <p className="mt-0.5 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{nextTitle}</p>
      </div>

      {/* Video URL */}
      <div>
        <label
          htmlFor="videoUrl"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Safety video URL{" "}
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

      {/* ── Standard site questions ────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              Standard site questions
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Applies to all workers on this project. Use short-answer questions for
              site-specific knowledge (first aid location, evacuation procedures, etc.).
            </p>
          </div>
          <button
            type="button"
            onClick={() => addQuestion(false)}
            className="flex-shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            + Add question
          </button>
        </div>

        {standard.length === 0 && (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            No standard questions yet. Add questions that every worker on this site must answer.
          </p>
        )}

        {standard.map(({ q, i }, displayIdx) => renderQuestion(q, i, displayIdx + 1))}
      </div>

      {/* ── Current risk questions ─────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              Current risk questions
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Added as site risks change. Each question is tagged with the date it was added.
              Workers who are already inducted must answer new risk questions before their next
              sign-in.
            </p>
          </div>
          <button
            type="button"
            onClick={() => addQuestion(true)}
            className="flex-shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50"
          >
            + Add risk question
          </button>
        </div>

        {risk.length === 0 && (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            No risk questions yet. Add questions here when site conditions change — they will be
            automatically flagged for all previously inducted workers.
          </p>
        )}

        {risk.map(({ q, i }, displayIdx) => renderQuestion(q, i, displayIdx + 1))}
      </div>

      <div className="flex items-center gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-700">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Publishing…" : "Publish induction"}
        </button>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Publishing creates a new version. Workers who completed the previous version will be
          notified to redo any changed questions.
        </p>
      </div>
    </form>
  );
}
