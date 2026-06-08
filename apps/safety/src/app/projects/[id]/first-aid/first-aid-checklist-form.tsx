"use client";

import { useActionState, useState } from "react";
import type { FirstAidState } from "./actions";

interface Item {
  id: string;
  description: string;
  compliant: boolean;
  notes: string;
}

interface Props {
  checklistType: "REQUIREMENTS" | "BOX_INSPECTION";
  itemDescriptions: string[];
  submitAction: (prev: FirstAidState, fd: FormData) => Promise<FirstAidState>;
}

export function FirstAidChecklistForm({ checklistType, itemDescriptions, submitAction }: Props) {
  const [state, formAction, pending] = useActionState(submitAction, {});
  const [items, setItems] = useState<Item[]>(() =>
    itemDescriptions.map((d, i) => ({ id: String(i), description: d, compliant: true, notes: "" })),
  );

  function toggle(id: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, compliant: !it.compliant } : it)));
  }

  function setNotes(id: string, notes: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, notes } : it)));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const hidden = (e.currentTarget as HTMLFormElement).elements.namedItem("items") as HTMLInputElement | null;
    if (hidden) hidden.value = JSON.stringify(items);
  }

  const nonCompliantCount = items.filter((i) => !i.compliant).length;

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-4">
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {nonCompliantCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {nonCompliantCount} item{nonCompliantCount !== 1 ? "s" : ""} non-compliant — corrective action required.
        </div>
      )}
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`rounded-lg border p-3 ${
              item.compliant
                ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                : "border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/20"
            }`}
          >
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={item.compliant}
                onChange={() => toggle(item.id)}
                className="mt-0.5 h-4 w-4 rounded"
              />
              <span className={`text-sm ${item.compliant ? "text-zinc-700 dark:text-zinc-300" : "text-amber-800 dark:text-amber-300"}`}>
                {item.description}
              </span>
            </label>
            {!item.compliant && (
              <div className="mt-2 ml-6">
                <input
                  type="text"
                  value={item.notes}
                  onChange={(e) => setNotes(item.id, e.target.value)}
                  placeholder="Notes / corrective action…"
                  className="w-full rounded-lg border border-amber-200 px-3 py-1.5 text-xs dark:border-amber-800/50 dark:bg-zinc-900"
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
          General notes
        </label>
        <textarea
          name="notes"
          rows={2}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>
      <input type="hidden" name="items" />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save checklist"}
      </button>
    </form>
  );
}
