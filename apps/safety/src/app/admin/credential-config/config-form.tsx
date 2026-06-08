"use client";

import { useActionState } from "react";
import { saveCredentialConfig, resetCredentialConfig } from "./actions";
import type { SaveConfigState } from "./actions";
import {
  CREDENTIAL_TYPE_GROUPS,
  IDENTITY_CREDENTIAL_TYPES,
} from "@/lib/credential-config";
import type { CredentialConfigData } from "@/lib/credential-config";

const checkboxCls =
  "h-4 w-4 rounded border-zinc-300 text-zinc-900 dark:border-zinc-600";
const inputCls =
  "w-24 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100";
const sectionCls =
  "rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";

export function CredentialConfigForm({ current }: { current: CredentialConfigData }) {
  const [state, action, pending] = useActionState<SaveConfigState, FormData>(
    saveCredentialConfig,
    {},
  );

  return (
    <form action={action} className="space-y-8">
      {state.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
          {state.success}
        </p>
      )}

      {/* ── Section 1: Acceptable identity document types ── */}
      <section className={sectionCls}>
        <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Acceptable identity documents
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Workers must upload at least one document from this list before site mobilisation.
            Uncheck a type to stop accepting it as valid identity proof.
          </p>
        </div>
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
          {IDENTITY_CREDENTIAL_TYPES.map((t) => (
            <label key={t.value} className="flex items-center gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                name={`identity_${t.value}`}
                defaultChecked={current.acceptableIdentityTypes.includes(t.value)}
                className={checkboxCls}
              />
              {t.label}
            </label>
          ))}
        </div>
      </section>

      {/* ── Section 2: Expiry alert thresholds ── */}
      <section className={sectionCls}>
        <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Expiry alert thresholds
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Controls when credentials turn amber (warning) or red (urgent) on worker profiles
            and readiness dashboards.
          </p>
        </div>
        <div className="flex flex-wrap gap-8 px-5 py-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
              Warning threshold
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                name="expiryWarnDays"
                min={2}
                max={365}
                defaultValue={current.expiryWarnDays}
                className={inputCls}
              />
              <span className="text-sm text-zinc-500">days before expiry → amber</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
              Urgent threshold
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                name="expiryUrgentDays"
                min={1}
                max={90}
                defaultValue={current.expiryUrgentDays}
                className={inputCls}
              />
              <span className="text-sm text-zinc-500">days before expiry → red</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: Expiry required per credential type ── */}
      <section className={sectionCls}>
        <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Expiry date requirements
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            When checked, workers must enter an expiry date for that credential type.
            Credentials without the required expiry date will be flagged as incomplete.
          </p>
        </div>
        <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
          {CREDENTIAL_TYPE_GROUPS.map((group) => (
            <div key={group.group} className="px-5 py-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                {group.group}
              </p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {group.types.map((t) => (
                  <label key={t.value} className="flex items-center gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      name={`expiry_${t.value}`}
                      defaultChecked={current.expiryRequiredTypes.includes(t.value)}
                      className={checkboxCls}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
        <form action={resetCredentialConfig}>
          <button
            type="submit"
            className="rounded-lg border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Reset to defaults
          </button>
        </form>
      </div>
    </form>
  );
}
