"use client";

import { useActionState, useRef, useEffect, useCallback, useState } from "react";
import type { VisitorSignInState } from "../actions";

interface Props {
  projectName: string;
  submitAction: (prev: VisitorSignInState, fd: FormData) => Promise<VisitorSignInState>;
}

function SignatureCanvas({
  canvasRef,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {
  const isDrawing = useRef(false);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#18181b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [canvasRef]);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  function getPos(canvas: HTMLCanvasElement, e: React.MouseEvent | React.TouchEvent) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * sx,
        y: (e.touches[0].clientY - rect.top) * sy,
      };
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * sx,
      y: ((e as React.MouseEvent).clientY - rect.top) * sy,
    };
  }

  function start(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    isDrawing.current = true;
    const pos = getPos(canvas, e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(canvas, e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function stop() {
    isDrawing.current = false;
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={600}
        height={150}
        onMouseDown={start}
        onMouseMove={draw}
        onMouseUp={stop}
        onMouseLeave={stop}
        onTouchStart={start}
        onTouchMove={draw}
        onTouchEnd={stop}
        className="w-full touch-none rounded-lg border border-zinc-300 bg-white"
        style={{ cursor: "crosshair" }}
      />
      <button
        type="button"
        onClick={initCanvas}
        className="mt-1 text-xs text-zinc-500 hover:text-zinc-700"
      >
        Clear signature
      </button>
    </div>
  );
}

export function VisitorSignInForm({ projectName, submitAction }: Props) {
  const [state, formAction, pending] = useActionState(submitAction, {});
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!acknowledged) {
      e.preventDefault();
      setClientError("Please read and acknowledge the site safety rules before signing in.");
      return;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const hasDrawing = Array.from(data).some((v, i) => i % 4 !== 3 && v < 200);
        if (!hasDrawing) {
          e.preventDefault();
          setClientError("Please provide your signature.");
          return;
        }
      }
    }
    setClientError(null);
    const sigDataUrl = canvasRef.current?.toDataURL("image/png") ?? "";
    const hidden = (e.currentTarget as HTMLFormElement).elements.namedItem(
      "signatureDataUrl",
    ) as HTMLInputElement | null;
    if (hidden) hidden.value = sigDataUrl;
  }

  const error = clientError ?? state.error;

  if (state.success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
        <div className="w-full max-w-md rounded-2xl border border-green-200 bg-white px-8 py-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-zinc-900">Signed in</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Welcome to {projectName}. Please report to the site manager.
          </p>
          <p className="mt-4 text-xs text-zinc-400">
            Remember to sign out when you leave the site.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-zinc-900">Visitor Sign-In</h1>
          <p className="mt-1 text-sm text-zinc-500">{projectName}</p>
        </div>

        <form action={formAction} onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
              {error}
            </div>
          )}

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-zinc-700">Your details</h2>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                Full name <span className="text-red-500">*</span>
              </label>
              <input
                name="visitorName"
                type="text"
                required
                placeholder="e.g. Jane Smith"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Company</label>
              <input
                name="company"
                type="text"
                placeholder="e.g. ABC Consulting"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Purpose of visit</label>
              <input
                name="purpose"
                type="text"
                placeholder="e.g. Client inspection"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Host / person you are visiting</label>
              <input
                name="hostName"
                type="text"
                placeholder="e.g. John Citizen"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-amber-800 mb-3">
              Site Safety Rules — please read carefully
            </h2>
            <ul className="space-y-1.5 text-xs text-amber-900">
              <li>• You must wear a hard hat and hi-vis vest in all work areas at all times.</li>
              <li>• You must wear enclosed footwear — no open-toed shoes or sandals.</li>
              <li>• Stay within designated visitor areas unless accompanied by site personnel.</li>
              <li>• Do not touch any plant, equipment, or materials.</li>
              <li>• Report any hazard or incident immediately to the site manager.</li>
              <li>• In an emergency, follow site personnel instructions and proceed to the assembly point.</li>
              <li>• Sign out before leaving the site.</li>
            </ul>
            <label className="mt-4 flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-300"
              />
              <span className="text-xs text-amber-800 font-medium">
                I have read and understood the site safety rules above.
              </span>
            </label>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-700 mb-3">Signature</h2>
            <p className="text-xs text-zinc-500 mb-2">
              By signing below, I acknowledge that I have read the safety rules and agree to comply with them.
            </p>
            <SignatureCanvas canvasRef={canvasRef} />
            <input type="hidden" name="signatureDataUrl" />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign in to site"}
          </button>
        </form>
      </div>
    </div>
  );
}
