"use client";

import { useActionState, useState } from "react";
import { workerLoginAction } from "./actions";
import type { LoginState } from "./actions";

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50";
const btnCls =
  "w-full rounded-lg bg-zinc-900 px-4 py-3 text-base font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(workerLoginAction, {
    step: "mobile",
  });
  const [offlineError, setOfflineError] = useState(false);

  const error = "error" in state ? state.error : undefined;
  const mobile = "mobile" in state ? state.mobile : "";
  const devCode = state.step === "verify" ? state.devCode : undefined;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!navigator.onLine) {
      e.preventDefault();
      setOfflineError(true);
      return;
    }
    setOfflineError(false);
  }

  return (
    <form action={action} onSubmit={handleSubmit} className="space-y-4">
      {/* Hidden step tracker */}
      <input type="hidden" name="_step" value={state.step} />

      {offlineError && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          You&apos;re offline. SMS sign-in requires an internet connection.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}

      {state.step === "mobile" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Mobile number
          </label>
          <input
            name="mobile"
            type="tel"
            required
            inputMode="tel"
            placeholder="04XX XXX XXX"
            className={inputCls}
          />
        </div>
      )}

      {state.step === "verify" && (
        <>
          <input type="hidden" name="mobile" value={mobile} />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Code sent to <span className="font-medium">{mobile}</span>.
          </p>
          {devCode && (
            <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 font-mono text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
              Dev mode — your code: {devCode}
            </p>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              6-digit code
            </label>
            <input
              name="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoComplete="one-time-code"
              className={inputCls}
            />
          </div>
        </>
      )}

      {state.step === "name" && (
        <>
          <input type="hidden" name="mobile" value={mobile} />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Mobile verified. Enter your name to create your worker account.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                First name
              </label>
              <input
                name="firstName"
                type="text"
                required
                autoCapitalize="words"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Last name
              </label>
              <input
                name="lastName"
                type="text"
                required
                autoCapitalize="words"
                className={inputCls}
              />
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400 space-y-2">
            <p className="font-semibold text-zinc-800 dark:text-zinc-200">Privacy Notice — Agero Group</p>
            <p>
              Agero Group collects your name, mobile number, and safety credentials (licences, inductions, SWMS signatures) to
              manage site access and comply with Victorian OHS legislation (OHS Act 2004 and OHS Regs 2017).
            </p>
            <p>
              Your information is stored securely in Australia and used solely for site safety management. We do not sell or
              share your data with third parties except as required by law or for emergency response.
            </p>
            <p>
              You may request access to or correction of your data by emailing <span className="font-medium">safety@agero.com.au</span>.
              Data is retained for 7 years in line with OHS regulatory requirements and then securely deleted.
            </p>
            <p>
              By creating an account you consent to this collection and use. See our full{" "}
              <a href="/privacy" target="_blank" className="underline hover:text-zinc-800 dark:hover:text-zinc-200">Privacy Policy</a>.
            </p>
          </div>
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              name="privacyConsent"
              required
              className="mt-0.5 h-4 w-4 accent-zinc-800"
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              I have read and accept the Privacy Notice above and consent to my personal information being collected and used as described.
            </span>
          </label>
        </>
      )}

      <button type="submit" disabled={pending} className={btnCls}>
        {pending
          ? state.step === "mobile"
            ? "Sending code…"
            : state.step === "verify"
              ? "Verifying…"
              : "Creating account…"
          : state.step === "mobile"
            ? "Send code"
            : state.step === "verify"
              ? "Verify"
              : "Create account"}
      </button>
    </form>
  );
}
