"use client";

import { useActionState, useState, useRef, useEffect, useCallback } from "react";
import { CHECKLIST_CATEGORIES, PHASE_1_DESCRIPTIONS } from "./constants";
import type { PlanSection, SitePrepPlanPayload, PlanSubmitState } from "./site-prep-plan-actions";

interface ProjectUser {
  id: string;
  name: string | null;
  email: string;
}

interface Props {
  submitAction: (prev: PlanSubmitState, fd: FormData) => Promise<PlanSubmitState>;
  projectUsers: ProjectUser[];
}

// ── Signature canvas ──────────────────────────────────────────────────────────

function SignatureCanvas({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
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

  function stop(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    isDrawing.current = false;
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={400}
        height={120}
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
        className="mt-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        Clear signature
      </button>
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

export function SitePrepPlanForm({ submitAction, projectUsers }: Props) {
  const [state, formAction, pending] = useActionState(submitAction, {});

  const today = new Date().toISOString().split("T")[0];

  const [sections, setSections] = useState<PlanSection[]>(() =>
    CHECKLIST_CATEGORIES.map((cat) => ({
      sectionId: cat.id,
      sectionName: cat.label,
      planNote: "",
      plannedCompletionDate: today,
    })),
  );

  const [signOffUserId, setSignOffUserId] = useState(projectUsers[0]?.id ?? "");
  const signOffName =
    projectUsers.find((u) => u.id === signOffUserId)?.name ??
    projectUsers.find((u) => u.id === signOffUserId)?.email ??
    "";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  function updateSection(id: string, patch: Partial<PlanSection>) {
    setSections((prev) => prev.map((s) => (s.sectionId === id ? { ...s, ...patch } : s)));
  }

  function validate(): string | null {
    if (!signOffName) return "Please select a sign-off person.";
    for (const s of sections) {
      if (!s.planNote.trim()) return `Plan note required for: ${s.sectionName}.`;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const hasDrawing = Array.from(data).some((v, i) => i % 4 !== 3 && v < 200);
        if (!hasDrawing) return "Please sign the form before submitting.";
      }
    }
    return null;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const err = validate();
    if (err) {
      e.preventDefault();
      setClientError(err);
      document.getElementById("plan-form-error")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setClientError(null);
    const signatureDataUrl = canvasRef.current?.toDataURL("image/png");
    const payload: SitePrepPlanPayload = {
      sections,
      signOffName,
      signOffDropdownUserId: signOffUserId,
      signatureDataUrl,
    };
    const hidden = (e.currentTarget as HTMLFormElement).elements.namedItem("payload") as HTMLInputElement | null;
    if (hidden) hidden.value = JSON.stringify(payload);
  }

  const error = clientError ?? state.error;
  const completedSections = sections.filter((s) => s.planNote.trim()).length;

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-8">
      <input type="hidden" name="payload" defaultValue="" />

      {error && (
        <div id="plan-form-error" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Progress indicator */}
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className="h-2 rounded-full bg-zinc-700 transition-all dark:bg-zinc-300"
            style={{ width: `${(completedSections / sections.length) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-xs text-zinc-500">{completedSections}/{sections.length} sections planned</span>
      </div>

      {/* ── 10 category sections ─────────────────────────────────────────────── */}
      {sections.map((s, i) => {
        const desc = PHASE_1_DESCRIPTIONS[s.sectionId];
        const done = !!s.planNote.trim();
        return (
          <div key={s.sectionId} className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-3 border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"}`}>
                {done ? "✓" : i + 1}
              </span>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{s.sectionName}</h3>
            </div>
            <div className="space-y-4 p-5">
              {desc && (
                <p className="text-xs text-zinc-500">{desc}</p>
              )}
              <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950/20 dark:text-blue-300">
                <span className="font-medium">Mark this on the worksite plan.</span> Reference floor plan when noting locations.
              </p>
              <label className="block">
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Where will this be located? How will it be set up? <span className="text-red-500">*</span>
                </span>
                <textarea
                  value={s.planNote}
                  onChange={(e) => updateSection(s.sectionId, { planNote: e.target.value })}
                  rows={3}
                  placeholder={`Describe the planned location and setup for ${s.sectionName.toLowerCase()}…`}
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Planned completion date</span>
                <input
                  type="date"
                  value={s.plannedCompletionDate}
                  onChange={(e) => updateSection(s.sectionId, { plannedCompletionDate: e.target.value })}
                  className="mt-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </label>
            </div>
          </div>
        );
      })}

      {/* ── Sign-off ─────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Phase 1 Sign-off</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Signing this plan confirms that the setup for each category has been documented and
          can proceed as planned. This locks Phase 1 and makes Phase 2 available on the day of site establishment.
        </p>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Sign off as <span className="text-red-500">*</span>
            </span>
            <select
              value={signOffUserId}
              onChange={(e) => setSignOffUserId(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              {projectUsers.length === 0 ? (
                <option value="">No users found</option>
              ) : (
                projectUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                ))
              )}
            </select>
          </label>

          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Signature <span className="text-red-500">*</span>
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">Sign using your finger (mobile) or mouse (desktop).</p>
            <div className="mt-2">
              <SignatureCanvas canvasRef={canvasRef} />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Date &amp; time</p>
            <p className="mt-1 rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800">
              Set automatically on submission
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-5 w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 sm:w-auto sm:px-8"
        >
          {pending ? "Saving…" : "Sign and complete Phase 1 planning"}
        </button>
      </div>
    </form>
  );
}
