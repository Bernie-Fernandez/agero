"use client";

import { useActionState, useState } from "react";
import { SAFETY_WALK_ITEMS } from "./constants";
import type { SafetyWalkState, SafetyWalkPayload, WalkItemResult } from "./actions";

interface Props {
  submitAction: (prev: SafetyWalkState, fd: FormData) => Promise<SafetyWalkState>;
  projectUsers: { id: string; name: string | null; email: string }[];
}

type Answer = "YES" | "NO" | "NA";

export function SafetyWalkForm({ submitAction, projectUsers }: Props) {
  const [state, formAction, pending] = useActionState(submitAction, {});
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [clientError, setClientError] = useState<string | null>(null);

  function setAnswer(id: string, answer: Answer) {
    setAnswers((prev) => ({ ...prev, [id]: answer }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const unanswered = SAFETY_WALK_ITEMS.filter((i) => !answers[i.id]);
    if (unanswered.length > 0) {
      e.preventDefault();
      setClientError(`Please answer all items. ${unanswered.length} unanswered.`);
      return;
    }
    setClientError(null);

    const items: WalkItemResult[] = SAFETY_WALK_ITEMS.map((item) => ({
      id: item.id,
      question: item.question,
      answer: answers[item.id]!,
      notes: notes[item.id] || undefined,
    }));

    const payload: SafetyWalkPayload = {
      conductedAt: (e.currentTarget.elements.namedItem("conductedAt") as HTMLInputElement).value,
      items,
      observations: (e.currentTarget.elements.namedItem("observations") as HTMLTextAreaElement).value,
      signOffUserId: (e.currentTarget.elements.namedItem("signOffUserId") as HTMLSelectElement).value,
    };

    const hidden = (e.currentTarget as HTMLFormElement).elements.namedItem("payload") as HTMLInputElement | null;
    if (hidden) hidden.value = JSON.stringify(payload);
  }

  const noCount = Object.values(answers).filter((a) => a === "NO").length;
  const answeredCount = Object.keys(answers).length;
  const error = clientError ?? state.error;

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
            Date conducted
          </label>
          <input
            name="conductedAt"
            type="datetime-local"
            defaultValue={new Date().toISOString().slice(0, 16)}
            required
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
            Conducted by
          </label>
          <select
            name="signOffUserId"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {projectUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ?? u.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Checklist — {answeredCount} of {SAFETY_WALK_ITEMS.length} answered
          </p>
          {noCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              {noCount} issue{noCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {SAFETY_WALK_ITEMS.map((item, i) => {
            const ans = answers[item.id];
            const isNo = ans === "NO";
            const isPsych = item.id === "sw23";
            return (
              <div
                key={item.id}
                className={`px-5 py-3 ${isNo ? "bg-amber-50/50 dark:bg-amber-950/10" : isPsych ? "bg-blue-50/30 dark:bg-blue-950/10" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 flex-1">
                    <span className="text-zinc-400 mr-1.5">{i + 1}.</span>
                    {item.question}
                    {isPsych && (
                      <span className="ml-1 text-xs text-blue-600 dark:text-blue-400">(Psych Health Regs)</span>
                    )}
                  </p>
                  <div className="flex gap-1 shrink-0">
                    {(["YES", "NO", "NA"] as Answer[]).map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAnswer(item.id, a)}
                        className={`rounded px-2.5 py-1 text-xs font-semibold ${
                          ans === a
                            ? a === "YES"
                              ? "bg-green-700 text-white"
                              : a === "NO"
                                ? "bg-amber-600 text-white"
                                : "bg-zinc-500 text-white"
                            : "border border-zinc-200 text-zinc-500 hover:border-zinc-400 dark:border-zinc-700"
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                {(isNo || isPsych) && (
                  <div className="mt-2 ml-4">
                    <input
                      type="text"
                      value={notes[item.id] ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder={isPsych ? "Describe observed psychosocial hazard…" : "Describe issue / corrective action required…"}
                      className={`w-full rounded-lg border px-3 py-1.5 text-xs dark:bg-zinc-900 ${
                        isPsych
                          ? "border-blue-200 dark:border-blue-800/50"
                          : "border-amber-200 dark:border-amber-800/50"
                      }`}
                    />
                    {isNo && (
                      <label className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
                        <input type="file" name={`photo_${item.id}`} accept="image/*" className="text-xs" />
                        <span>Attach photo</span>
                      </label>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          General observations
        </label>
        <textarea
          name="observations"
          rows={3}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      <input type="hidden" name="payload" />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save safety walk"}
      </button>
    </form>
  );
}
