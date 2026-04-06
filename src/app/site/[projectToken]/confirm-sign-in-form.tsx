"use client";

import { useActionState, useRef, useState } from "react";
import type { SignInState } from "./actions";
import { SiteSignOutLink } from "./site-sign-out";

const btnCls =
  "w-full rounded-lg bg-zinc-900 px-4 py-3 text-base font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

export function ConfirmSignInForm({
  signInAction,
  workerPrefill,
  session,
  projectToken,
}: {
  signInAction: (prev: SignInState, fd: FormData) => Promise<SignInState>;
  workerPrefill?: { id: string; firstName: string; lastName: string } | null;
  session: { mobile: string; firstName: string; lastName: string } | null;
  projectToken: string;
}) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInAction, {});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  if (state.blockedUntilVerified) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950/30">
        <p className="text-lg font-semibold text-red-700 dark:text-red-300">Sign-in blocked</p>
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          Your previous sign-in is awaiting supervisor verification. Please speak to the site manager.
        </p>
      </div>
    );
  }

  if (state.requiresInduction && state.inductionUrl) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-800 dark:bg-amber-950/30">
        <p className="text-lg font-semibold text-amber-700 dark:text-amber-300">Induction required</p>
        {state.inductionTitle && (
          <p className="mt-1 font-medium text-amber-800 dark:text-amber-200">{state.inductionTitle}</p>
        )}
        <a
          href={state.inductionUrl}
          className="mt-4 inline-block rounded-lg bg-amber-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-800"
        >
          Start induction →
        </a>
      </div>
    );
  }

  const displayName = workerPrefill
    ? `${workerPrefill.firstName} ${workerPrefill.lastName}`
    : session
      ? `${session.firstName} ${session.lastName}`
      : null;

  return (
    <form action={action} encType="multipart/form-data" className="space-y-5">
      {workerPrefill && <input type="hidden" name="workerId" value={workerPrefill.id} />}
      {!workerPrefill && session && <input type="hidden" name="mobile" value={session.mobile} />}

      {state.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </p>
      )}

      <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 dark:border-green-800 dark:bg-green-950/30">
        <p className="text-sm font-medium text-green-800 dark:text-green-300">
          {workerPrefill ? "Induction complete — ready to sign in" : "Signed in as"}
        </p>
        {displayName && (
          <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{displayName}</p>
        )}
        {session && !workerPrefill && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{session.mobile}</p>
        )}
      </div>

      {/* Optional photo */}
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
              onClick={() => {
                setPhotoPreview(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="text-xs text-zinc-500 hover:text-zinc-700"
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
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setPhotoPreview(URL.createObjectURL(file));
              }}
              className="hidden"
            />
          </label>
        )}
      </div>

      <button type="submit" disabled={pending} className={btnCls}>
        {pending ? "Signing in…" : "Confirm sign-in"}
      </button>

      {!workerPrefill && session && (
        <div className="text-center">
          <SiteSignOutLink projectToken={projectToken} />
        </div>
      )}
    </form>
  );
}
