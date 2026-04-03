"use client";

import { useActionState } from "react";
import {
  completeOnboarding,
  type OnboardingState,
} from "./actions";

const initialState: OnboardingState = {};

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(
    completeOnboarding,
    initialState,
  );

  return (
    <form action={formAction} className="mt-8 max-w-md space-y-5">
      {state.error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <div>
        <label
          htmlFor="organisationName"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Organisation name <span className="text-red-500">*</span>
        </label>
        <input
          id="organisationName"
          name="organisationName"
          type="text"
          required
          autoComplete="organization"
          placeholder="e.g. Acme Construction Pty Ltd"
          className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none ring-zinc-400 placeholder:text-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:ring-zinc-500"
        />
      </div>

      <div>
        <label
          htmlFor="abn"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          ABN
        </label>
        <input
          id="abn"
          name="abn"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 51 824 753 556"
          maxLength={14}
          className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none ring-zinc-400 placeholder:text-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:ring-zinc-500"
        />
        <p className="mt-1 text-xs text-zinc-500">11-digit Australian Business Number</p>
      </div>

      <div>
        <label
          htmlFor="tradeCategory"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Trade category
        </label>
        <input
          id="tradeCategory"
          name="tradeCategory"
          type="text"
          placeholder="e.g. Electrical, Plumbing, Civil"
          className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none ring-zinc-400 placeholder:text-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:ring-zinc-500"
        />
      </div>

      <div>
        <label
          htmlFor="primaryContact"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Primary contact name
        </label>
        <input
          id="primaryContact"
          name="primaryContact"
          type="text"
          placeholder="e.g. Jane Smith"
          className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none ring-zinc-400 placeholder:text-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:ring-zinc-500"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "Creating…" : "Continue to dashboard"}
      </button>
    </form>
  );
}
