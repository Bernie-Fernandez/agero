"use client";

import { useActionState } from "react";
import type { WorkerEditState } from "./actions";

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50";
const labelCls = "block text-xs font-medium text-zinc-600 dark:text-zinc-400";

export function WorkerEditForm({
  worker,
  action,
}: {
  worker: {
    whiteCardNo: string | null;
    whiteCardExpiry: Date | null;
    nokName: string | null;
    nokPhone: string | null;
    nokRelationship: string | null;
  };
  action: (prev: WorkerEditState, fd: FormData) => Promise<WorkerEditState>;
}) {
  const [state, formAction, pending] = useActionState<WorkerEditState, FormData>(action, {});

  return (
    <form action={formAction} className="mt-4 space-y-5">
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

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          White Card
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Card number</label>
            <input
              name="whiteCardNo"
              type="text"
              defaultValue={worker.whiteCardNo ?? ""}
              placeholder="e.g. QLD-123456"
              className={`mt-1 ${inputCls}`}
            />
          </div>
          <div>
            <label className={labelCls}>Expiry date</label>
            <input
              name="whiteCardExpiry"
              type="date"
              defaultValue={
                worker.whiteCardExpiry
                  ? worker.whiteCardExpiry.toISOString().split("T")[0]
                  : ""
              }
              className={`mt-1 ${inputCls}`}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Next of Kin
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Full name</label>
            <input
              name="nokName"
              type="text"
              defaultValue={worker.nokName ?? ""}
              className={`mt-1 ${inputCls}`}
            />
          </div>
          <div>
            <label className={labelCls}>Mobile</label>
            <input
              name="nokPhone"
              type="tel"
              defaultValue={worker.nokPhone ?? ""}
              placeholder="04XX XXX XXX"
              className={`mt-1 ${inputCls}`}
            />
          </div>
          <div>
            <label className={labelCls}>Relationship</label>
            <input
              name="nokRelationship"
              type="text"
              defaultValue={worker.nokRelationship ?? ""}
              placeholder="e.g. Spouse, Parent"
              className={`mt-1 ${inputCls}`}
            />
          </div>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
