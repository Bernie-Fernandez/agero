"use client";

import { useActionState } from "react";
import { updateProfile } from "./actions";
import type { ProfileState } from "./actions";
import { TRADE_CATEGORIES } from "@/lib/trade-categories";

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50";

const labelCls = "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400";

const AU_STATES = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"];

type Account = {
  mobile: string;
  firstName: string;
  lastName: string;
  trades: string[];
  dateOfBirth: Date | null;
  addressStreet: string | null;
  addressSuburb: string | null;
  addressState: string | null;
  addressPostcode: string | null;
  nokName: string | null;
  nokRelationship: string | null;
  nokMobile: string | null;
  medicalConditions: string | null;
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

      {/* Personal details */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Personal details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>First name</label>
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
            <label className={labelCls}>Last name</label>
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
          <label className={labelCls}>Mobile number</label>
          <input
            name="mobile"
            type="tel"
            required
            defaultValue={account.mobile}
            inputMode="tel"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Date of birth</label>
          <input
            name="dateOfBirth"
            type="date"
            defaultValue={dateToInput(account.dateOfBirth)}
            className={inputCls}
          />
        </div>
      </section>

      {/* Home address */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Home address</h2>
        <div>
          <label className={labelCls}>Street address</label>
          <input
            name="addressStreet"
            type="text"
            defaultValue={account.addressStreet ?? ""}
            autoComplete="street-address"
            className={inputCls}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className={labelCls}>Suburb</label>
            <input
              name="addressSuburb"
              type="text"
              defaultValue={account.addressSuburb ?? ""}
              autoComplete="address-level2"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>State</label>
            <select
              name="addressState"
              defaultValue={account.addressState ?? ""}
              className={inputCls}
            >
              <option value="">—</option>
              {AU_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Postcode</label>
            <input
              name="addressPostcode"
              type="text"
              inputMode="numeric"
              maxLength={4}
              defaultValue={account.addressPostcode ?? ""}
              autoComplete="postal-code"
              className={inputCls}
            />
          </div>
        </div>
      </section>

      {/* Next of kin / Emergency contact — MANDATORY */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Emergency contact{" "}
            <span className="text-red-600 dark:text-red-400" aria-label="required">*</span>
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            <strong className="font-medium">Why we collect this:</strong> Required by WorkSafe Victoria to notify your nominated contact in the event of a serious incident on site.
            Accessed only by site supervisors or emergency services. Not shared with any third party.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>
              Full name <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <input
              name="nokName"
              type="text"
              required
              defaultValue={account.nokName ?? ""}
              autoCapitalize="words"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              Relationship <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <input
              name="nokRelationship"
              type="text"
              required
              placeholder="e.g. Spouse, Parent, Sibling"
              defaultValue={account.nokRelationship ?? ""}
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>
            Mobile number <span className="text-red-600 dark:text-red-400">*</span>
          </label>
          <input
            name="nokMobile"
            type="tel"
            required
            inputMode="tel"
            defaultValue={account.nokMobile ?? ""}
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

      {/* Medical conditions */}
      <section className="space-y-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Medical information
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            <strong className="font-medium">Why we collect this:</strong> Enables site supervisors and first-aid officers to provide appropriate emergency care.
            Stored securely and accessible only to on-site personnel with a safety role. You may choose not to disclose.
          </p>
        </div>
        <div>
          <label className={labelCls}>
            Any medical conditions we should be aware of on site?{" "}
            <span className="font-normal text-zinc-400 dark:text-zinc-500">(optional)</span>
          </label>
          <textarea
            name="medicalConditions"
            rows={3}
            defaultValue={account.medicalConditions ?? ""}
            placeholder="e.g. allergies, asthma, diabetes, restricted lifting…"
            className={`${inputCls} resize-y`}
          />
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            This information is kept confidential and shared only with site supervisors in an
            emergency.
          </p>
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
