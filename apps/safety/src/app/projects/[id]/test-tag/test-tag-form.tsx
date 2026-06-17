"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { TestTagState } from "./actions";

interface Props {
  submitAction: (prev: TestTagState, fd: FormData) => Promise<TestTagState>;
}

export function TestTagForm({ submitAction }: Props) {
  const [state, formAction, pending] = useActionState(submitAction, {});
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state.ok]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        + Add item
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-4"
    >
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-300">
          {state.error}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Item description *</label>
          <input name="itemName" required className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Owner</label>
          <input name="owner" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Location</label>
          <input name="location" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Tag colour</label>
          <input name="tagColour" placeholder="e.g. Red" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Last test date *</label>
          <input name="lastTestDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
          <p className="mt-1 text-xs text-zinc-400">Next test auto-set 3 months later</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Tested by</label>
          <input name="testedBy" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
        </div>
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Add to register"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          Cancel
        </button>
      </div>
    </form>
  );
}
