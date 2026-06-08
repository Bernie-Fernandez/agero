"use client";

import { useActionState, useRef, useEffect, useCallback, useState } from "react";
import type { NcrState, NcrPayload } from "./actions";

interface Props {
  submitAction: (prev: NcrState, fd: FormData) => Promise<NcrState>;
}

function SigCanvas({ label, onCapture }: { label: string; onCapture: (url: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [signed, setSigned] = useState(false);

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
    setSigned(false);
    onCapture("");
  }, [onCapture]);

  useEffect(() => { initCanvas(); }, [initCanvas]);

  function getPos(canvas: HTMLCanvasElement, e: React.MouseEvent | React.TouchEvent) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    if ("touches" in e) {
      return { x: (e.touches[0].clientX - rect.left) * sx, y: (e.touches[0].clientY - rect.top) * sy };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * sx, y: ((e as React.MouseEvent).clientY - rect.top) * sy };
  }

  function start(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    isDrawing.current = true;
    const pos = getPos(canvas, e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const pos = getPos(canvas, e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setSigned(true);
  }

  function stop() {
    isDrawing.current = false;
    if (signed && canvasRef.current) {
      onCapture(canvasRef.current.toDataURL("image/png"));
    }
  }

  return (
    <div>
      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{label}</p>
      <canvas
        ref={canvasRef}
        width={400}
        height={100}
        onMouseDown={start}
        onMouseMove={draw}
        onMouseUp={stop}
        onMouseLeave={stop}
        onTouchStart={start}
        onTouchMove={draw}
        onTouchEnd={stop}
        className="w-full touch-none rounded-lg border border-zinc-200 bg-white dark:border-zinc-700"
        style={{ cursor: "crosshair" }}
      />
      <button
        type="button"
        onClick={initCanvas}
        className="mt-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        Clear
      </button>
      {signed && (
        <p className="mt-0.5 text-xs text-green-600 dark:text-green-400">✓ Signature captured</p>
      )}
    </div>
  );
}

export function NcrForm({ submitAction }: Props) {
  const [state, formAction, pending] = useActionState(submitAction, {});
  const [ageroSig, setAgeroSig] = useState("");
  const [contractorSig, setContractorSig] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!ageroSig) {
      e.preventDefault();
      setClientError("Agero manager signature is required.");
      return;
    }
    if (!contractorSig) {
      e.preventDefault();
      setClientError("Contractor/worker signature is required.");
      return;
    }
    setClientError(null);
    const form = e.currentTarget;
    const payload: NcrPayload = {
      raisedAt: (form.elements.namedItem("raisedAt") as HTMLInputElement).value,
      description: (form.elements.namedItem("description") as HTMLTextAreaElement).value,
      correctiveAction: (form.elements.namedItem("correctiveAction") as HTMLTextAreaElement).value,
      disposition: (form.elements.namedItem("disposition") as HTMLTextAreaElement).value,
      ageroSignatureDataUrl: ageroSig,
      contractorName: (form.elements.namedItem("contractorName") as HTMLInputElement).value,
      contractorSignatureDataUrl: contractorSig,
    };
    const hidden = form.elements.namedItem("payload") as HTMLInputElement | null;
    if (hidden) hidden.value = JSON.stringify(payload);
  }

  const error = clientError ?? state.error;

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Date raised
        </label>
        <input
          name="raisedAt"
          type="datetime-local"
          defaultValue={new Date().toISOString().slice(0, 16)}
          required
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
            Part A — Description of Non-Conformance
          </label>
          <p className="text-xs text-zinc-500 mb-2">
            Describe the non-conformance, including what was observed, where, and who was involved.
          </p>
          <textarea
            name="description"
            required
            rows={4}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
            Part B — Corrective Action Required
          </label>
          <p className="text-xs text-zinc-500 mb-2">
            Describe the corrective action to be taken, by whom, and by when.
          </p>
          <textarea
            name="correctiveAction"
            required
            rows={4}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
            Part C — Disposition
          </label>
          <p className="text-xs text-zinc-500 mb-2">
            State the final outcome: rework required, accepted as-is, or other resolution.
          </p>
          <textarea
            name="disposition"
            required
            rows={3}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Digital signatures</h2>
        <p className="text-xs text-zinc-500">
          Both parties must sign before this NCR can be submitted. This document is immutable once submitted.
        </p>
        <SigCanvas label="Agero Manager signature" onCapture={setAgeroSig} />
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
            Contractor / worker name
          </label>
          <input
            name="contractorName"
            type="text"
            required
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>
        <SigCanvas label="Contractor / worker signature" onCapture={setContractorSig} />
      </div>

      <input type="hidden" name="payload" />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit NCR (immutable)"}
      </button>
    </form>
  );
}
