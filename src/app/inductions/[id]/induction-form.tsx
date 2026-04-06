"use client";

import { useActionState, useState, useEffect } from "react";
import type { InductionSubmitState } from "./actions";
import { InductionChat } from "./induction-chat";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const MAX_ANON_ATTEMPTS = 3;

type Question = {
  question: string;
  type?: "multiple_choice" | "short_answer";
  options?: string[];
  correctAnswers?: number[];
  correctAnswer?: number; // legacy
};

function isMultiAnswer(q: Question): boolean {
  if (Array.isArray(q.correctAnswers)) return q.correctAnswers.length > 1;
  return false;
}

type Phase = "questions" | "failed" | "blocked" | "passed";

export function InductionForm({
  questions,
  submitAction,
  initialLockedCorrect,
  isReInduction,
  projectName,
  templateTitle,
  showChat,
}: {
  questions: Question[];
  submitAction: (prev: InductionSubmitState, fd: FormData) => Promise<InductionSubmitState>;
  /** Question indices already credited from a prior template version (re-induction). */
  initialLockedCorrect?: number[];
  /** True when the worker has a prior completion and is only answering new risk questions. */
  isReInduction?: boolean;
  projectName?: string;
  templateTitle?: string;
  showChat?: boolean;
}) {
  const [state, action, pending] = useActionState(submitAction, {});
  const [agreed, setAgreed] = useState(false);
  const [phase, setPhase] = useState<Phase>("questions");

  // Indices of questions answered correctly across all attempts.
  // Sent back as a hidden input on each retry so the server auto-credits them.
  const [lockedCorrect, setLockedCorrect] = useState<number[]>(initialLockedCorrect ?? []);

  // What the worker selected on their last failed attempt, keyed by question index string.
  // Displayed as "Your last answer" highlights — never pre-selected.
  const [prevSelections, setPrevSelections] = useState<Record<string, number[]>>({});

  // Remaining attempts for anonymous users (tracked in sessionStorage).
  const [anonAttemptsLeft, setAnonAttemptsLeft] = useState<number | undefined>(undefined);

  // Controlled state for single-answer questions only.
  const [singleSelect, setSingleSelect] = useState<Record<number, number | undefined>>({});

  // 1-based attempt counter — increments each time the worker retries.
  const [attemptNumber, setAttemptNumber] = useState(1);

  // On mount, check sessionStorage for anonymous attempts already made.
  // sessionStorage persists within the browser tab so refreshing the page counts.
  useEffect(() => {
    const key = `induction-anon-${window.location.pathname}`;
    const stored = parseInt(sessionStorage.getItem(key) ?? "0", 10);
    if (stored >= MAX_ANON_ATTEMPTS) {
      setPhase("blocked");
    } else if (stored > 0) {
      setAnonAttemptsLeft(MAX_ANON_ATTEMPTS - stored);
    }
  }, []);

  // Transition phase whenever the server action returns a new result.
  useEffect(() => {
    if (state.passed === true) {
      setPhase("passed");
    } else if (state.passed === false) {
      if (state.blocked || state.attemptsLeft === 0) {
        // Authenticated worker: server says blocked
        setPhase("blocked");
      } else if (state.attemptsLeft !== undefined) {
        // Authenticated worker: attempts remaining
        setPhase("failed");
      } else {
        // Anonymous: track in sessionStorage
        const key = `induction-anon-${window.location.pathname}`;
        const stored = parseInt(sessionStorage.getItem(key) ?? "0", 10);
        const next = stored + 1;
        sessionStorage.setItem(key, String(next));
        const left = MAX_ANON_ATTEMPTS - next;
        if (next >= MAX_ANON_ATTEMPTS) {
          setPhase("blocked");
          setAnonAttemptsLeft(0);
        } else {
          setPhase("failed");
          setAnonAttemptsLeft(left);
        }
      }
    } else if (state.blocked === true) {
      // Pre-submit block: existing active block detected before scoring
      setPhase("blocked");
    }
  }, [state]);

  function handleRetry() {
    setLockedCorrect(state.correctIndices ?? []);
    setPrevSelections(state.previousSelections ?? {});
    setSingleSelect({});
    setAttemptNumber((n) => n + 1);
    setPhase("questions");
  }

  function handleSingleCheck(qi: number, oi: number) {
    setSingleSelect((s) => ({ ...s, [qi]: s[qi] === oi ? undefined : oi }));
  }

  // ── No questions ───────────────────────────────────────────────────────────
  if (questions.length === 0) {
    return (
      <p className="text-zinc-500 dark:text-zinc-400">
        This induction has no questions yet. Check back soon.
      </p>
    );
  }

  // ── Passed — declaration / signature (authenticated worker) ───────────────
  if (phase === "passed" && state.needsSignature && state.declarationPreview) {
    const d = state.declarationPreview;
    return (
      <div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
          <p className="text-sm font-semibold text-green-700 dark:text-green-300">
            ✓ Passed with {state.score}% — please read and sign the declaration below
          </p>
        </div>

        <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Electronic Declaration — {d.templateTitle} v{d.version}
          </h3>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 whitespace-pre-line">
            {d.text}
          </div>
        </div>

        <form action={action} className="mt-5 space-y-4">
          <input type="hidden" name="phase" value="sign" />
          <input type="hidden" name="confirmed" value={agreed ? "true" : "false"} />

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-zinc-900 dark:accent-zinc-100"
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              I have read and understood the above declaration and agree to its terms.
            </span>
          </label>

          {state.error && (
            <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending || !agreed}
            className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {pending ? "Recording…" : "Sign electronically and complete induction"}
          </button>
        </form>
      </div>
    );
  }

  // ── Passed + signed — completion confirmation ─────────────────────────────
  if (phase === "passed" && state.signed) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center dark:border-green-800 dark:bg-green-950/30">
        <p className="text-4xl font-bold text-green-700 dark:text-green-300">✓</p>
        <p className="mt-3 text-xl font-semibold text-green-800 dark:text-green-200">
          Induction complete
        </p>
        {state.workerName && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {state.workerName}
          </p>
        )}
        {state.signedAt && (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
            Signed{" "}
            {new Date(state.signedAt).toLocaleString("en-AU", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Australia/Melbourne",
            })}
          </p>
        )}
        <p className="mt-4 text-sm text-green-700 dark:text-green-400">
          Your declaration has been recorded. You may now sign in to site.
        </p>
      </div>
    );
  }

  // ── Passed — anonymous / preview ──────────────────────────────────────────
  if (phase === "passed") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center dark:border-green-800 dark:bg-green-950/30">
        <p className="text-3xl font-bold text-green-700 dark:text-green-300">✓ Passed</p>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          You scored {state.score}%
          {state.score !== undefined && state.total !== undefined
            ? ` (${Math.round((state.score / 100) * state.total)}/${state.total} correct)`
            : ""}
        </p>
      </div>
    );
  }

  // ── Blocked ────────────────────────────────────────────────────────────────
  if (phase === "blocked") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/30">
        {state.score !== undefined && (
          <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
            You scored {state.score}%
            {state.total !== undefined
              ? ` (${Math.round((state.score / 100) * state.total)}/${state.total} correct)`
              : ""}
          </p>
        )}
        <p className="text-xl font-bold text-red-700 dark:text-red-300">
          You are not permitted to work on site for the next 24 hours. Please review the safety
          material carefully before retrying.
        </p>
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          You have used all 3 attempts. Your employer has been notified.
        </p>
        {state.blockedUntil && (
          <p className="mt-3 text-sm font-medium text-red-700 dark:text-red-300">
            You may retry from:{" "}
            <span className="font-semibold">
              {new Date(state.blockedUntil).toLocaleString("en-AU", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </p>
        )}
      </div>
    );
  }

  // ── Failed — attempts remaining ────────────────────────────────────────────
  if (phase === "failed") {
    // Authenticated workers get attemptsLeft from server; anonymous from sessionStorage state
    const attemptsLeft = state.attemptsLeft ?? anonAttemptsLeft;
    return (
      <div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950/30">
          <p className="text-3xl font-bold text-red-700 dark:text-red-300">✗ Not passed</p>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            You scored {state.score}%
            {state.score !== undefined && state.total !== undefined
              ? ` (${Math.round((state.score / 100) * state.total)}/${state.total} correct)`
              : ""}
          </p>
          <p className="mt-2 text-sm font-medium text-red-700 dark:text-red-300">
            You must score 100% to pass.
          </p>
          {attemptsLeft !== undefined && (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              You have {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining.
            </p>
          )}
        </div>
        <button
          onClick={handleRetry}
          className="mt-4 w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Try again
        </button>
      </div>
    );
  }

  // ── Questions form ─────────────────────────────────────────────────────────
  //
  // On retry, lockedCorrect contains indices the worker already answered correctly.
  // Those questions are hidden; the server auto-credits them via the hidden input.
  // prevSelections shows the worker what they chose last time (highlighted, not pre-selected).
  //
  // Multi-answer: uncontrolled checkboxes — browser owns tick state.
  // Single-answer: controlled checkboxes via singleSelect for exclusivity.
  //
  const wrongCount = questions.length - lockedCorrect.length;

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="phase" value="answer" />
      <input type="hidden" name="lockedCorrect" value={JSON.stringify(lockedCorrect)} />

      {state.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      )}

      {attemptNumber > 1 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          ⚠ Note: your previous answers are shown for reference, but for multi-select questions you may have missed an option — review all answers carefully.
        </div>
      )}

      {lockedCorrect.length > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
          {isReInduction
            ? `✓ ${lockedCorrect.length} standard question${lockedCorrect.length !== 1 ? "s" : ""} credited from your previous induction. Only your ${wrongCount} new risk question${wrongCount !== 1 ? "s" : ""} ${wrongCount === 1 ? "is" : "are"} shown below.`
            : `✓ ${lockedCorrect.length} question${lockedCorrect.length !== 1 ? "s" : ""} answered correctly and locked in from your previous attempt. Only your ${wrongCount} incorrect ${wrongCount === 1 ? "answer is" : "answers are"} shown below.`}
        </div>
      )}

      {questions.map((q, i) => {
        // Skip questions the worker already answered correctly
        if (lockedCorrect.includes(i)) return null;

        if (q.type === "short_answer") {
          return (
            <fieldset
              key={i}
              className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <legend className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {i + 1}. {q.question}
              </legend>
              <p className="mt-1 mb-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                (Short answer — type your response below)
              </p>
              <textarea
                name={`q${i}`}
                rows={3}
                placeholder="Your answer..."
                className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </fieldset>
          );
        }

        const multi = isMultiAnswer(q);
        const prevSelected = prevSelections[String(i)] as number[] | undefined;

        return (
          <fieldset
            key={i}
            className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <legend className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {i + 1}. {q.question}
            </legend>
            <p className="mt-1 mb-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {multi ? "(Select all that apply)" : "(Select one answer)"}
            </p>
            <div className="space-y-2">
              {(q.options ?? []).map((opt, oi) => {
                const wasPrevSelected = prevSelected?.includes(oi) ?? false;
                return (
                  <label
                    key={oi}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1 transition-colors ${
                      wasPrevSelected
                        ? "bg-red-50 dark:bg-red-950/30"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    {multi ? (
                      <input
                        type="checkbox"
                        name={`q${i}`}
                        value={oi}
                        className="h-4 w-4 flex-shrink-0 accent-blue-600 dark:accent-blue-500"
                      />
                    ) : (
                      <input
                        type="checkbox"
                        name={`q${i}`}
                        value={oi}
                        checked={singleSelect[i] === oi}
                        onChange={() => handleSingleCheck(i, oi)}
                        className="h-4 w-4 flex-shrink-0 accent-blue-600 dark:accent-blue-500"
                      />
                    )}
                    <span className="w-5 flex-shrink-0 text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                      {LETTERS[oi]}
                    </span>
                    <span className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">{opt}</span>
                    {wasPrevSelected && (
                      <span className="shrink-0 text-xs font-medium text-red-500 dark:text-red-400">
                        Your last answer
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Submitting…" : "Submit answers"}
      </button>

      {showChat && projectName && templateTitle && (
        <InductionChat
          key={attemptNumber}
          projectName={projectName}
          templateTitle={templateTitle}
          retryCount={attemptNumber - 1}
        />
      )}
    </form>
  );
}
