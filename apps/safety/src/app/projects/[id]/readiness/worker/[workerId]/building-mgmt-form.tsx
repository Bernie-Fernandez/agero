"use client";

import { useActionState } from "react";
import type { BldgMgmtState } from "./actions";

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50";
const labelCls = "block text-xs font-medium text-zinc-600 dark:text-zinc-400";

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

export function BuildingMgmtRecordForm({
  markAction,
}: {
  markAction: (prev: BldgMgmtState, fd: FormData) => Promise<BldgMgmtState>;
}) {
  const [state, formAction, pending] = useActionState<BldgMgmtState, FormData>(markAction, {});

  return (
    <form action={formAction} className="mt-4 space-y-4">
      {state.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200">
          {state.success}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Conducted by (building manager name)</label>
          <input
            name="completedByName"
            type="text"
            required
            placeholder="e.g. John Smith — Building Manager"
            className={`mt-1 ${inputCls}`}
          />
        </div>
        <div>
          <label className={labelCls}>Date completed</label>
          <input
            name="completedAt"
            type="date"
            defaultValue={todayIso()}
            required
            className={`mt-1 ${inputCls}`}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "Saving…" : "Record completion"}
      </button>
    </form>
  );
}

export function BuildingMgmtRemoveForm({
  completion,
  removeAction,
}: {
  completion: { completedAt: Date; completedByName: string };
  removeAction: (prev: BldgMgmtState, fd: FormData) => Promise<BldgMgmtState>;
}) {
  const [state, formAction, pending] = useActionState<BldgMgmtState, FormData>(removeAction, {});

  return (
    <div className="mt-4 space-y-3">
      {state.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      )}
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800 dark:bg-green-950/30">
        <p className="text-sm font-medium text-green-800 dark:text-green-300">Induction recorded</p>
        <p className="mt-0.5 text-xs text-green-700 dark:text-green-400">
          Completed {new Date(completion.completedAt).toLocaleDateString("en-AU")} · Conducted by{" "}
          {completion.completedByName}
        </p>
      </div>
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="text-xs text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
        >
          {pending ? "Removing…" : "Remove record"}
        </button>
      </form>
    </div>
  );
}
