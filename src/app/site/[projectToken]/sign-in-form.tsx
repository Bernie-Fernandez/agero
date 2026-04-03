"use client";

import { useActionState, useRef, useState } from "react";
import type { SignInState } from "./actions";

export function SignInForm({
  signInAction,
}: {
  signInAction: (prev: SignInState, fd: FormData) => Promise<SignInState>;
}) {
  const [state, action, pending] = useActionState(signInAction, {});
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch {
      alert("Camera not available. You can continue without a photo.");
    }
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.8);
    setPhotoDataUrl(dataUrl);
    (videoRef.current.srcObject as MediaStream)?.getTracks().forEach((t) => t.stop());
    setCameraActive(false);
  }

  function retakePhoto() {
    setPhotoDataUrl(null);
    startCamera();
  }

  if (state.blockedUntilVerified) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950/30">
        <p className="text-lg font-semibold text-red-700 dark:text-red-300">Sign-in blocked</p>
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          Your previous sign-in has not been verified. Please speak to the site supervisor before signing in again.
        </p>
      </div>
    );
  }

  if (state.requiresInduction && state.inductionUrl) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-800 dark:bg-amber-950/30">
        <p className="text-lg font-semibold text-amber-700 dark:text-amber-300">Induction required</p>
        <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
          You need to complete your safety induction before signing in.
        </p>
        <a
          href={state.inductionUrl}
          className="mt-4 inline-block rounded-lg bg-amber-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-800"
        >
          Start induction →
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      {state.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">First name *</label>
          <input id="firstName" name="firstName" type="text" required autoCapitalize="words"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50" />
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Last name *</label>
          <input id="lastName" name="lastName" type="text" required autoCapitalize="words"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50" />
        </div>
      </div>

      <div>
        <label htmlFor="mobile" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Mobile number *</label>
        <input id="mobile" name="mobile" type="tel" required inputMode="tel" placeholder="04XX XXX XXX"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50" />
      </div>

      {/* Photo capture */}
      <div>
        <p className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Photo</p>
        {!cameraActive && !photoDataUrl && (
          <button type="button" onClick={startCamera}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800">
            Take photo
          </button>
        )}
        {cameraActive && (
          <div className="space-y-2">
            <video ref={videoRef} className="w-full max-w-xs rounded-lg" autoPlay playsInline muted />
            <button type="button" onClick={capturePhoto}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900">
              Capture
            </button>
          </div>
        )}
        {photoDataUrl && (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoDataUrl} alt="Sign-in photo" className="w-24 h-24 rounded-full object-cover" />
            <button type="button" onClick={retakePhoto} className="text-xs text-zinc-500 hover:text-zinc-700">Retake</button>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
        {photoDataUrl && (
          <input type="hidden" name="photo" value={photoDataUrl} />
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-base font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Signing in…" : "Sign in to site"}
      </button>
    </form>
  );
}
