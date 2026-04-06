"use client";

import { useActionState } from "react";
import { updateProfile } from "./actions";
import type { ProfileState } from "./actions";
import { TRADE_CATEGORIES } from "@/lib/trade-categories";

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50";

type Account = {
  mobile: string;
  firstName: string;
  lastName: string;
  trades: string[];
  whiteCardNumber: string | null;
  whiteCardExpiry: Date | null;
  tradeLicenceNumber: string | null;
  tradeLicenceExpiry: Date | null;
  firstAidCertNumber: string | null;
  firstAidExpiry: Date | null;
};

function dateToInput(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

export function ProfileForm({ account }: { account: Account }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, {});

  return (
    <form action={action} className="space-y-6">
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

      {/* Identity */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Personal details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              First name
            </label>
            <input
              name="firstName"
              type="text"
              required
              defaultValue={account.firstName}
              autoCapitalize="words"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Last name
            </label>
            <input
              name="lastName"
              type="text"
              required
              defaultValue={account.lastName}
              autoCapitalize="words"
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Mobile number
          </label>
          <input
            name="mobile"
            type="tel"
            required
            defaultValue={account.mobile}
            inputMode="tel"
            className={inputCls}
          />
        </div>
      </section>

      {/* Trades */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Trade/s</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          {TRADE_CATEGORIES.map((trade) => (
            <label key={trade} className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                name="trades"
                value={trade}
                defaultChecked={account.trades.includes(trade)}
                className="rounded border-zinc-300 text-zinc-900 dark:border-zinc-600"
              />
              {trade}
            </label>
          ))}
        </div>
      </section>

      {/* Certifications */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Certifications</h2>

        {/* White card */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              White card number
            </label>
            <input
              name="whiteCardNumber"
              type="text"
              defaultValue={account.whiteCardNumber ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Expiry date
            </label>
            <input
              name="whiteCardExpiry"
              type="date"
              defaultValue={dateToInput(account.whiteCardExpiry)}
              className={inputCls}
            />
          </div>
        </div>

        {/* Trade licence */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Trade licence number
            </label>
            <input
              name="tradeLicenceNumber"
              type="text"
              defaultValue={account.tradeLicenceNumber ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Expiry date
            </label>
            <input
              name="tradeLicenceExpiry"
              type="date"
              defaultValue={dateToInput(account.tradeLicenceExpiry)}
              className={inputCls}
            />
          </div>
        </div>

        {/* First aid */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              First aid certificate number
            </label>
            <input
              name="firstAidCertNumber"
              type="text"
              defaultValue={account.firstAidCertNumber ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Expiry date
            </label>
            <input
              name="firstAidExpiry"
              type="date"
              defaultValue={dateToInput(account.firstAidExpiry)}
              className={inputCls}
            />
          </div>
        </div>
      </section>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-base font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
