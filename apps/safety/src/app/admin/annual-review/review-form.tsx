"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import type { ReviewState, ReviewPayload } from "./actions";

interface ChecklistItem {
  item: string;
  clause?: string;
  confirmed: boolean;
  notes?: string;
}

interface Props {
  templateName: string;
  isoClauses: string[];
  complianceCodes: string[];
  submitAction: (prev: ReviewState, fd: FormData) => Promise<ReviewState>;
}

function buildChecklist(isoClauses: string[], complianceCodes: string[]): ChecklistItem[] {
  const items: ChecklistItem[] = [
    { item: "Document content reviewed in full and remains fit for purpose", confirmed: false },
    { item: "No legislative or regulatory changes since the last review affect this document", confirmed: false },
  ];
  for (const code of complianceCodes) {
    items.push({ item: `Aligned with current requirements of: ${code}`, confirmed: false });
  }
  for (const clause of isoClauses) {
    items.push({ item: `Satisfies ISO 45001 Clause ${clause} requirements`, clause, confirmed: false });
  }
  items.push({ item: "Consultation with workers/HSRs considered where applicable", confirmed: false });
  return items;
}

function SignaturePad({ onCapture, onClear }: { onCapture: (d: string) => void; onClear: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [signed, setSigned] = useState(false);

  const init = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#18181b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    setSigned(false);
  }, []);

  useEffect(() => init(), [init]);

  function pos(c: HTMLCanvasElement, e: React.MouseEvent | React.TouchEvent) {
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width;
    const sy = c.height / r.height;
    if ("touches" in e) return { x: (e.touches[0].clientX - r.left) * sx, y: (e.touches[0].clientY - r.top) * sy };
    return { x: ((e as React.MouseEvent).clientX - r.left) * sx, y: ((e as React.MouseEvent).clientY - r.top) * sy };
  }
  function start(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    drawing.current = true;
    const p = pos(c, e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function move(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (!drawing.current) return;
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const p = pos(c, e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setSigned(true);
  }
  function stop() {
    drawing.current = false;
    if (signed && canvasRef.current) onCapture(canvasRef.current.toDataURL("image/png"));
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={400}
        height={100}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={stop}
        onMouseLeave={stop}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={stop}
        className="w-full touch-none rounded border border-zinc-200 bg-white dark:border-zinc-700"
        style={{ cursor: "crosshair" }}
      />
      <button type="button" onClick={() => { init(); onClear(); }} className="mt-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
        Clear signature
      </button>
    </div>
  );
}

export function ReviewForm({ templateName, isoClauses, complianceCodes, submitAction }: Props) {
  const [state, formAction, pending] = useActionState(submitAction, {});
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => buildChecklist(isoClauses, complianceCodes));
  const [outcome, setOutcome] = useState<"CURRENT" | "UPDATED">("CURRENT");
  const [notes, setNotes] = useState("");
  const [signature, setSignature] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  function toggle(i: number) {
    setChecklist((prev) => prev.map((c, idx) => (idx === i ? { ...c, confirmed: !c.confirmed } : c)));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!checklist.every((c) => c.confirmed)) {
      e.preventDefault();
      setClientError("Confirm every checklist item before signing off.");
      return;
    }
    if (!signature) {
      e.preventDefault();
      setClientError("A signature is required.");
      return;
    }
    setClientError(null);
    const payload: ReviewPayload = { checklist, outcome, notes: notes.trim(), signatureDataUrl: signature };
    const hidden = e.currentTarget.elements.namedItem("payload") as HTMLInputElement | null;
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

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Review checklist — {templateName}</h2>
        {checklist.map((c, i) => (
          <label key={i} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 cursor-pointer ${c.confirmed ? "border-green-300 bg-green-50 dark:border-green-800/50 dark:bg-green-950/20" : "border-zinc-200 dark:border-zinc-800"}`}>
            <input type="checkbox" checked={c.confirmed} onChange={() => toggle(i)} className="mt-0.5 h-4 w-4" />
            <span className="text-xs text-zinc-700 dark:text-zinc-300">
              {c.item}
              {c.clause && <span className="ml-1 text-zinc-400">(Clause {c.clause})</span>}
            </span>
          </label>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Outcome</label>
          <select value={outcome} onChange={(e) => setOutcome(e.target.value as "CURRENT" | "UPDATED")} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800">
            <option value="CURRENT">Confirmed current — no changes</option>
            <option value="UPDATED">Document updated — new version</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Reviewer notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Reviewer signature</label>
          <SignaturePad onCapture={setSignature} onClear={() => setSignature("")} />
          {signature && <p className="mt-1 text-xs text-green-600 dark:text-green-400">✓ Signature captured</p>}
        </div>
      </div>

      <input type="hidden" name="payload" />
      <button type="submit" disabled={pending} className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-60">
        {pending ? "Signing off…" : "Sign off & create new version"}
      </button>
    </form>
  );
}
