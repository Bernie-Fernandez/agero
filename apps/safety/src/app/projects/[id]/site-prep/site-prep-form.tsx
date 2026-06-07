"use client";

import { useActionState, useState } from "react";
import { CHECKLIST_CATEGORIES, ALL_ITEMS } from "./constants";
import { uploadChecklistPhoto } from "./actions";
import type { SubmitState, SitePrepPayload } from "./actions";
import type { ChecklistItemResult } from "@/lib/pdf/site-prep-pdf";

interface ItemState {
  answer: "YES" | "NO" | "NA";
  note: string;
  photoUrl: string | null;
  uploading: boolean;
}

function initItems(): Record<string, ItemState> {
  const record: Record<string, ItemState> = {};
  for (const item of ALL_ITEMS) {
    record[item.id] = { answer: "NA", note: "", photoUrl: null, uploading: false };
  }
  return record;
}

interface Props {
  safetyProjectId: string;
  submitAction: (prev: SubmitState, fd: FormData) => Promise<SubmitState>;
}

export function SitePrepForm({ safetyProjectId, submitAction }: Props) {
  const [state, formAction, pending] = useActionState(submitAction, {});

  const today = new Date().toISOString().split("T")[0];
  const [completionDate, setCompletionDate] = useState(today);
  const [items, setItems] = useState<Record<string, ItemState>>(initItems);
  const [managerSignOffName, setManagerSignOffName] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  function setItem(id: string, patch: Partial<ItemState>) {
    setItems((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function handlePhotoChange(itemId: string, file: File) {
    setItem(itemId, { uploading: true });
    setClientError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("safetyProjectId", safetyProjectId);
    fd.append("itemId", itemId);
    const result = await uploadChecklistPhoto(fd);
    if (result.url) {
      setItem(itemId, { photoUrl: result.url, uploading: false });
    } else {
      setItem(itemId, { uploading: false });
      setClientError(result.error ?? "Photo upload failed.");
      const el = document.getElementById("form-error");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function validate(): string | null {
    if (!completionDate) return "Completion date is required.";
    if (!managerSignOffName.trim()) return "Site manager name is required for sign-off.";
    const noItems = Object.entries(items)
      .filter(([, s]) => s.answer === "NO")
      .map(([id]) => id);
    for (const id of noItems) {
      const s = items[id];
      const item = ALL_ITEMS.find((i) => i.id === id);
      if (!s.note.trim())
        return `A note is required for: "${item?.label.substring(0, 50)}…"`;
      if (!s.photoUrl)
        return `A photo is required for: "${item?.label.substring(0, 50)}…"`;
    }
    return null;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const err = validate();
    if (err) {
      e.preventDefault();
      setClientError(err);
      const el = document.getElementById("form-error");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      setClientError(null);
      const payload: SitePrepPayload = {
        completionDate,
        managerSignOffName,
        items: ALL_ITEMS.map((item): ChecklistItemResult => ({
          id: item.id,
          category: item.category,
          label: item.label,
          answer: items[item.id].answer,
          note: items[item.id].note || undefined,
          photoUrl: items[item.id].photoUrl || undefined,
        })),
      };
      const hidden = (e.currentTarget as HTMLFormElement).elements.namedItem(
        "payload",
      ) as HTMLInputElement | null;
      if (hidden) hidden.value = JSON.stringify(payload);
    }
  }

  const yesCount = Object.values(items).filter((s) => s.answer === "YES").length;
  const noCount = Object.values(items).filter((s) => s.answer === "NO").length;
  const naCount = Object.values(items).filter((s) => s.answer === "NA").length;
  const totalAnswered = yesCount + noCount + naCount;
  const error = clientError ?? state.error;

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-8">
      <input type="hidden" name="payload" defaultValue="" />

      {/* Error banner */}
      {error && (
        <div
          id="form-error"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {/* Progress bar */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{totalAnswered} of {ALL_ITEMS.length} items answered</span>
          <span className="flex gap-3">
            <span className="text-green-600 dark:text-green-400">{yesCount} YES</span>
            <span className="text-red-600 dark:text-red-400">{noCount} NO</span>
            <span>{naCount} N/A</span>
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-zinc-900 transition-all dark:bg-zinc-100"
            style={{ width: `${(totalAnswered / ALL_ITEMS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Completion date */}
      <section>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Completion date</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Date on which the site preparation was inspected (typically Day 1 of site establishment).
        </p>
        <input
          type="date"
          value={completionDate}
          onChange={(e) => setCompletionDate(e.target.value)}
          className="mt-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          required
        />
      </section>

      {/* Checklist items by category */}
      {CHECKLIST_CATEGORIES.map((cat) => {
        const catNoCount = cat.items.filter((i) => items[i.id]?.answer === "NO").length;
        return (
          <section key={cat.id}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  {cat.label}
                </h2>
                <p className="mt-0.5 text-xs text-zinc-400">{cat.items.length} items</p>
              </div>
              {catNoCount > 0 && (
                <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                  {catNoCount} NO
                </span>
              )}
            </div>

            <div className="mt-3 space-y-2">
              {cat.items.map((item, idx) => {
                const s = items[item.id];
                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border bg-white dark:bg-zinc-900 ${s.answer === "NO" ? "border-red-200 dark:border-red-800/60" : "border-zinc-200 dark:border-zinc-800"}`}
                  >
                    <div className="flex items-start gap-3 px-4 py-3">
                      <span className="mt-0.5 w-5 shrink-0 text-xs text-zinc-400">{idx + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm text-zinc-800 dark:text-zinc-200">{item.label}</p>
                        {item.regulatory && (
                          <p className="mt-0.5 text-xs text-zinc-400">{item.regulatory}</p>
                        )}
                      </div>
                      {/* YES / NO / NA buttons */}
                      <div className="flex shrink-0 gap-1.5">
                        {(["YES", "NO", "NA"] as const).map((ans) => (
                          <button
                            key={ans}
                            type="button"
                            onClick={() => setItem(item.id, { answer: ans })}
                            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                              s.answer === ans
                                ? ans === "YES"
                                  ? "bg-green-600 text-white"
                                  : ans === "NO"
                                    ? "bg-red-600 text-white"
                                    : "bg-zinc-700 text-white dark:bg-zinc-200 dark:text-zinc-900"
                                : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                            }`}
                          >
                            {ans}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* NO expansion */}
                    {s.answer === "NO" && (
                      <div className="border-t border-red-100 bg-red-50/40 px-4 pb-4 pt-3 dark:border-red-800/30 dark:bg-red-950/10">
                        <label className="block">
                          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            Note — describe the issue <span className="text-red-500">*</span>
                          </span>
                          <textarea
                            value={s.note}
                            onChange={(e) => setItem(item.id, { note: e.target.value })}
                            rows={2}
                            placeholder="Describe what is missing or non-compliant…"
                            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                          />
                        </label>

                        <div className="mt-3">
                          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            Photo evidence <span className="text-red-500">*</span>
                          </span>
                          {s.photoUrl ? (
                            <div className="mt-1.5 flex items-center gap-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={s.photoUrl}
                                alt="Evidence"
                                className="h-20 w-28 rounded-lg object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => setItem(item.id, { photoUrl: null })}
                                className="text-xs text-red-500 hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <label className="mt-1.5 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-500 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600">
                              {s.uploading ? (
                                <span className="text-xs text-zinc-400">Uploading…</span>
                              ) : (
                                <>
                                  <span className="text-base">📷</span>
                                  <span className="text-xs">Take or upload photo</span>
                                </>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="sr-only"
                                disabled={s.uploading}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) void handlePhotoChange(item.id, file);
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Sign-off */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Sign-off</h2>
        <p className="mt-1 text-sm text-zinc-500">
          By signing you confirm the checklist has been completed accurately on the date above.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Site manager name <span className="text-red-500">*</span>
            </span>
            <input
              type="text"
              value={managerSignOffName}
              onChange={(e) => setManagerSignOffName(e.target.value)}
              placeholder="Full name"
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Date &amp; time</p>
            <p className="mt-1.5 rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800">
              Set automatically on submission
            </p>
          </div>
        </div>

        {noCount > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300">
            {noCount} non-compliant item{noCount !== 1 ? "s" : ""} identified. Corrective actions must be
            addressed and re-inspected before site mobilisation.
          </div>
        )}

        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700 dark:border-blue-800/40 dark:bg-blue-950/20 dark:text-blue-300">
          A PDF will be generated with all results and any evidence photos, and emailed to the
          Director and Safety Manager.
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-5 w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 sm:w-auto sm:px-8"
        >
          {pending ? "Submitting…" : "Submit and sign checklist"}
        </button>
      </section>
    </form>
  );
}
