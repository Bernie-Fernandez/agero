"use client";

import { useActionState, useRef, useState } from "react";
import type { SiteAuthState } from "./site-auth-actions";
import type { SignInState } from "./actions";

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50";
const btnCls =
  "w-full rounded-lg bg-zinc-900 px-4 py-3 text-base font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

export function SiteAuthGate({
  siteAuthAction,
  signInAction,
}: {
  siteAuthAction: (prev: SiteAuthState, fd: FormData) => Promise<SiteAuthState>;
  signInAction: (prev: SignInState, fd: FormData) => Promise<SignInState>;
}) {
  const [authState, authFormAction, authPending] = useActionState<SiteAuthState, FormData>(
    siteAuthAction,
    { step: "mobile" },
  );

  const [signInState, signInFormAction, signInPending] = useActionState<SignInState, FormData>(
    signInAction,
    {},
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
  }

  // After sign-in action returns induction requirements
  if (signInState.requiresInduction && signInState.inductionUrl) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-800 dark:bg-amber-950/30">
        <p className="text-lg font-semibold text-amber-700 dark:text-amber-300">Induction required</p>
        {signInState.inductionTitle && (
          <p className="mt-1 font-medium text-amber-800 dark:text-amber-200">
            {signInState.inductionTitle}
          </p>
        )}
        <a
          href={signInState.inductionUrl}
          className="mt-4 inline-block rounded-lg bg-amber-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-800"
        >
          Start induction →
        </a>
      </div>
    );
  }

  if (signInState.blockedUntilVerified) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950/30">
        <p className="text-lg font-semibold text-red-700 dark:text-red-300">Sign-in blocked</p>
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          Your previous sign-in is awaiting supervisor verification. Please speak to the site manager.
        </p>
      </div>
    );
  }

  // Auth step: ready — show photo + confirm form
  if (authState.step === "ready") {
    const mobile = "mobile" in authState ? authState.mobile : "";
    return (
      <form action={signInFormAction} encType="multipart/form-data" className="space-y-5">
        {signInState.error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {signInState.error}
          </p>
        )}
        <input type="hidden" name="mobile" value={mobile} />
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800 dark:bg-green-950/30">
          <p className="text-sm font-medium text-green-800 dark:text-green-300">
            Identity verified
          </p>
          <p className="text-xs text-green-600 dark:text-green-400">{mobile}</p>
        </div>

        <PhotoCapture
          fileInputRef={fileInputRef}
          photoPreview={photoPreview}
          onPhotoChange={handlePhotoChange}
          onRetake={() => {
            setPhotoPreview(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        />

        <button type="submit" disabled={signInPending} className={btnCls}>
          {signInPending ? "Signing in…" : "Sign in to site"}
        </button>
      </form>
    );
  }

  // Auth step: name collection
  if (authState.step === "name") {
    const mobile = authState.mobile;
    return (
      <form action={authFormAction} className="space-y-4">
        <input type="hidden" name="_step" value="name" />
        <input type="hidden" name="mobile" value={mobile} />
        {authState.error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {authState.error}
          </p>
        )}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Mobile verified. Enter your name to continue.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              First name
            </label>
            <input name="firstName" type="text" required autoCapitalize="words" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Last name
            </label>
            <input name="lastName" type="text" required autoCapitalize="words" className={inputCls} />
          </div>
        </div>
        <button type="submit" disabled={authPending} className={btnCls}>
          {authPending ? "Continuing…" : "Continue"}
        </button>
      </form>
    );
  }

  // Auth step: verify
  if (authState.step === "verify") {
    const mobile = authState.mobile;
    return (
      <form action={authFormAction} className="space-y-4">
        <input type="hidden" name="_step" value="verify" />
        <input type="hidden" name="mobile" value={mobile} />
        {authState.error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {authState.error}
          </p>
        )}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Code sent to <span className="font-medium">{mobile}</span>.
        </p>
        {authState.devCode && (
          <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 font-mono text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
            Dev mode — code: {authState.devCode}
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
        <button type="submit" disabled={authPending} className={btnCls}>
          {authPending ? "Verifying…" : "Verify"}
        </button>
      </form>
    );
  }

  // Auth step: mobile entry (default)
  return (
    <form action={authFormAction} className="space-y-4">
      <input type="hidden" name="_step" value="mobile" />
      {authState.step === "mobile" && authState.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {authState.error}
        </p>
      )}
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
      <button type="submit" disabled={authPending} className={btnCls}>
        {authPending ? "Sending code…" : "Send verification code"}
      </button>
    </form>
  );
}

function PhotoCapture({
  fileInputRef,
  photoPreview,
  onPhotoChange,
  onRetake,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  photoPreview: string | null;
  onPhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRetake: () => void;
}) {
  return (
    <div>
      <p className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Photo (optional)
      </p>
      {photoPreview ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoPreview} alt="Preview" className="h-24 w-24 rounded-full object-cover" />
          <button
            type="button"
            onClick={onRetake}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Retake
          </button>
        </div>
      ) : (
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Take photo
          <input
            ref={fileInputRef}
            type="file"
            name="photo"
            accept="image/*"
            capture="environment"
            onChange={onPhotoChange}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
}
