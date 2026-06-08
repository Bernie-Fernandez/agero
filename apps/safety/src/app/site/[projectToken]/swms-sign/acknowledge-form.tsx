"use client";

import { useActionState, useRef } from "react";
import type { SwmsSignState } from "./actions";

const initialState: SwmsSignState = {};

export function AcknowledgeForm({
  submitAction,
}: {
  submitAction: (prev: SwmsSignState, formData: FormData) => Promise<SwmsSignState>;
}) {
  const [state, formAction, pending] = useActionState(submitAction, initialState);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  function getPos(
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement,
  ) {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDraw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    isDrawing.current = true;
    const pos = getPos(e, canvas);
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
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#18181b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  function stopDraw() {
    isDrawing.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const canvas = canvasRef.current;
    const dataUrl = canvas?.toDataURL("image/png") ?? "";
    const hiddenInput = e.currentTarget.elements.namedItem("signatureDataUrl") as HTMLInputElement;
    if (hiddenInput) hiddenInput.value = dataUrl;
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="mt-8 space-y-6">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          name="acknowledged"
          value="1"
          className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-zinc-300 text-blue-600"
        />
        <span className="text-sm text-zinc-700 dark:text-zinc-300">
          I confirm that I have read and understood all SWMS documents listed above, and I will
          comply with the safe work method statements for my work on this site.
        </span>
      </label>

      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Signature</p>
        <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
          <canvas
            ref={canvasRef}
            width={400}
            height={120}
            className="w-full touch-none"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
          />
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-zinc-300 select-none dark:text-zinc-600">
            Sign here
          </p>
        </div>
        <button
          type="button"
          onClick={clearCanvas}
          className="mt-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          Clear
        </button>
      </div>

      <input type="hidden" name="signatureDataUrl" defaultValue="" />

      {state.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Sign and continue"}
      </button>
    </form>
  );
}
