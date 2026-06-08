"use client";

import { useActionState } from "react";
import type { ChecklistState } from "./actions";

const initialState: ChecklistState = {};

type Defaults = {
  firstName: string;
  lastName: string;
  whiteCardNo: string;
  whiteCardExpiry: string;
  nokName: string;
  nokPhone: string;
  nokRelationship: string;
};

export function ChecklistForm({
  submitAction,
  defaults,
}: {
  submitAction: (prev: ChecklistState, formData: FormData) => Promise<ChecklistState>;
  defaults: Partial<Defaults>;
}) {
  const [state, formAction, pending] = useActionState(submitAction, initialState);

  return (
    <form action={formAction} className="space-y-6">
      {/* Identity */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Your details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              First name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="firstName"
              defaultValue={defaults.firstName}
              required
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Last name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="lastName"
              defaultValue={defaults.lastName}
              required
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        </div>
      </section>

      {/* White card */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          White Card (General Construction Induction)
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              White card number
            </label>
            <input
              type="text"
              name="whiteCardNo"
              defaultValue={defaults.whiteCardNo}
              placeholder="e.g. VIC12345678"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Expiry date
            </label>
            <input
              type="date"
              name="whiteCardExpiry"
              defaultValue={defaults.whiteCardExpiry}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        </div>
      </section>

      {/* Next of kin */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Emergency contact (next of kin)
        </h2>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Full name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="nokName"
            defaultValue={defaults.nokName}
            required
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Phone number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              name="nokPhone"
              defaultValue={defaults.nokPhone}
              required
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Relationship
            </label>
            <input
              type="text"
              name="nokRelationship"
              defaultValue={defaults.nokRelationship}
              placeholder="e.g. Spouse, Parent"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        </div>
      </section>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit checklist"}
      </button>
    </form>
  );
}
