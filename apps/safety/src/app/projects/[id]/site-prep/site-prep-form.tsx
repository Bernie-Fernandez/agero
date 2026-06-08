"use client";

import { useActionState, useState, useRef, useEffect, useCallback } from "react";
import { CHECKLIST_CATEGORIES } from "./constants";
import { uploadChecklistPhoto } from "./actions";
import type { SubmitState, SitePrepPayload } from "./actions";
import type { SectionResult } from "@/lib/pdf/site-prep-pdf";

interface ProjectUser {
  id: string;
  name: string | null;
  email: string;
}

interface PlanSectionHint {
  sectionId: string;
  sectionName: string;
  planNote: string;
  plannedCompletionDate: string;
}

interface SectionState {
  answer: "YES" | "NO" | "NA";
  note: string;
  photoUrl: string | null;
  uploading: boolean;
}

interface PlanPin {
  categoryIndex: number;
  x: number;
  y: number;
}

interface Props {
  safetyProjectId: string;
  submitAction: (prev: SubmitState, fd: FormData) => Promise<SubmitState>;
  projectUsers: ProjectUser[];
  planSections?: PlanSectionHint[];
  planPins?: PlanPin[];
  floorPlanUrl?: string | null;
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

function initSections(): Record<string, SectionState> {
  const record: Record<string, SectionState> = {};
  for (const cat of CHECKLIST_CATEGORIES) {
    record[cat.id] = { answer: "NA", note: "", photoUrl: null, uploading: false };
  }
  return record;
}

const PIN_COLOURS = [
  "#ef4444","#f97316","#eab308","#22c55e","#06b6d4",
  "#3b82f6","#8b5cf6","#ec4899","#14b8a6","#78716c",
];

export function SitePrepForm({ safetyProjectId, submitAction, projectUsers, planSections, planPins, floorPlanUrl }: Props) {
  const [state, formAction, pending] = useActionState(submitAction, {});

  const today = new Date().toISOString().split("T")[0];
  const [completionDate, setCompletionDate] = useState(today);
  const [sections, setSections] = useState<Record<string, SectionState>>(initSections);
  const [signOffUserId, setSignOffUserId] = useState(projectUsers[0]?.id ?? "");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  const signOffUser = projectUsers.find((u) => u.id === signOffUserId);
  const signOffName = signOffUser?.name ?? signOffUser?.email ?? "";

  const planNoteMap = new Map<string, PlanSectionHint>();
  for (const ps of planSections ?? []) {
    planNoteMap.set(ps.sectionId, ps);
  }
  const pinByCatIndex = new Map<number, PlanPin>();
  for (const pin of planPins ?? []) {
    pinByCatIndex.set(pin.categoryIndex, pin);
  }
  const isImageFloorPlan = floorPlanUrl && !floorPlanUrl.toLowerCase().endsWith(".pdf");

  function setSection(id: string, patch: Partial<SectionState>) {
    setSections((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function handlePhotoChange(sectionId: string, file: File) {
    setSection(sectionId, { uploading: true });
    setClientError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("safetyProjectId", safetyProjectId);
    fd.append("sectionId", sectionId);
    const result = await uploadChecklistPhoto(fd);
    if (result.url) {
      setSection(sectionId, { photoUrl: result.url, uploading: false });
    } else {
      setSection(sectionId, { uploading: false });
      setClientError(result.error ?? "Photo upload failed.");
      document.getElementById("form-error")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function validate(): string | null {
    if (!completionDate) return "Inspection date is required.";
    if (!signOffName) return "Please select a sign-off person.";

    const noSections = CHECKLIST_CATEGORIES.filter((c) => sections[c.id]?.answer === "NO");
    for (const cat of noSections) {
      const s = sections[cat.id];
      if (!s.note.trim()) return `A note is required for: ${cat.label}.`;
      if (!s.photoUrl) return `A photo is required for: ${cat.label}.`;
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
      document.getElementById("form-error")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setClientError(null);
    const signatureDataUrl = canvasRef.current?.toDataURL("image/png");
    const sectionResults: SectionResult[] = CHECKLIST_CATEGORIES.map((cat) => ({
      sectionId: cat.id,
      sectionName: cat.label,
      answer: sections[cat.id].answer,
      note: sections[cat.id].note || undefined,
      photoUrl: sections[cat.id].photoUrl || undefined,
    }));
    const payload: SitePrepPayload = {
      completionDate,
      sections: sectionResults,
      signOffDropdownUserId: signOffUserId,
      signatureDataUrl,
    };
    const hidden = (e.currentTarget as HTMLFormElement).elements.namedItem("payload") as HTMLInputElement | null;
    if (hidden) hidden.value = JSON.stringify(payload);
  }

  const yesCount = CHECKLIST_CATEGORIES.filter((c) => sections[c.id]?.answer === "YES").length;
  const noCount = CHECKLIST_CATEGORIES.filter((c) => sections[c.id]?.answer === "NO").length;
  const naCount = CHECKLIST_CATEGORIES.filter((c) => sections[c.id]?.answer === "NA").length;
  const answeredCount = yesCount + noCount;
  const error = clientError ?? state.error;

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="payload" defaultValue="" />

      {/* Error banner */}
      {error && (
        <div
          id="form-error"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {/* Progress bar */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{answeredCount} of {CHECKLIST_CATEGORIES.length} sections confirmed</span>
          <span className="flex gap-3">
            <span className="text-green-600 dark:text-green-400">{yesCount} YES</span>
            {noCount > 0 && <span className="text-red-600 dark:text-red-400">{noCount} NO</span>}
            <span>{naCount} N/A</span>
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-zinc-900 transition-all dark:bg-zinc-100"
            style={{ width: `${(answeredCount / CHECKLIST_CATEGORIES.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Inspection date */}
      <section>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Inspection date</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Date on which the site setup was physically inspected (typically Day 1 of site establishment).
        </p>
        <input
          type="date"
          value={completionDate}
          onChange={(e) => setCompletionDate(e.target.value)}
          className="mt-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          required
        />
      </section>

      {/* Floor plan reference */}
      {isImageFloorPlan && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Floor Plan Reference</h2>
          <div className="relative overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={floorPlanUrl!} alt="Floor plan" className="w-full object-contain" style={{ maxHeight: 320 }} />
            {Array.from(pinByCatIndex.entries()).map(([idx, pin]) => (
              <div
                key={idx}
                className="pointer-events-none absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold text-white shadow-lg"
                style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%`, background: PIN_COLOURS[idx % PIN_COLOURS.length] }}
              >
                {idx + 1}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section cards */}
      {CHECKLIST_CATEGORIES.map((cat, i) => {
        const s = sections[cat.id];
        const hint = planNoteMap.get(cat.id);
        const isDone = s.answer !== "NA";
        return (
          <div
            key={cat.id}
            className={`rounded-xl border bg-white dark:bg-zinc-900 ${
              s.answer === "NO"
                ? "border-red-200 dark:border-red-800/60"
                : isDone
                  ? "border-green-200 dark:border-green-800/40"
                  : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <div className="flex items-center gap-3 border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  s.answer === "YES"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                    : s.answer === "NO"
                      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                }`}
              >
                {s.answer === "YES" ? "✓" : s.answer === "NO" ? "✗" : i + 1}
              </span>
              <h3 className="flex-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {cat.label}
              </h3>
              {pinByCatIndex.has(i) && (
                <span
                  className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: PIN_COLOURS[i % PIN_COLOURS.length] }}
                  title="Floor plan pin"
                >
                  {i + 1}
                </span>
              )}
              <span className="text-xs text-zinc-400">{cat.items.length} items</span>
            </div>

            <div className="p-5 space-y-4">
              {/* Phase 1 plan hint */}
              {hint && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 dark:border-blue-900/30 dark:bg-blue-950/20">
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Planned setup</p>
                  <p className="mt-0.5 text-xs text-blue-600 dark:text-blue-400">{hint.planNote}</p>
                </div>
              )}

              {/* YES / NO / NA buttons */}
              <div className="flex gap-2">
                {(["YES", "NO", "NA"] as const).map((ans) => (
                  <button
                    key={ans}
                    type="button"
                    onClick={() => setSection(cat.id, { answer: ans })}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      s.answer === ans
                        ? ans === "YES"
                          ? "bg-green-600 text-white"
                          : ans === "NO"
                            ? "bg-red-600 text-white"
                            : "bg-zinc-700 text-white dark:bg-zinc-200 dark:text-zinc-900"
                        : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {ans === "NA" ? "N/A" : ans}
                  </button>
                ))}
              </div>

              {/* NO expansion */}
              {s.answer === "NO" && (
                <div className="space-y-3 rounded-lg border border-red-100 bg-red-50/40 p-4 dark:border-red-800/30 dark:bg-red-950/10">
                  <label className="block">
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Note — describe the issue <span className="text-red-500">*</span>
                    </span>
                    <textarea
                      value={s.note}
                      onChange={(e) => setSection(cat.id, { note: e.target.value })}
                      rows={2}
                      placeholder="Describe what is missing or non-compliant…"
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    />
                  </label>

                  <div>
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Photo evidence <span className="text-red-500">*</span>
                    </span>
                    {s.photoUrl ? (
                      <div className="mt-1.5 flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={s.photoUrl}
                          alt="Evidence"
                          className="h-20 w-28 rounded-lg object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setSection(cat.id, { photoUrl: null })}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label className="mt-1.5 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-500 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600">
                        {s.uploading ? (
                          <span className="text-xs text-zinc-400">Uploading…</span>
                        ) : (
                          <>
                            <span className="text-base">📷</span>
                            <span className="text-xs">Take or upload photo</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="sr-only"
                          disabled={s.uploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void handlePhotoChange(cat.id, file);
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Sign-off */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Sign-off</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Signing confirms the checklist has been completed accurately on the inspection date above.
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

        {noCount > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300">
            {noCount} non-compliant section{noCount !== 1 ? "s" : ""} identified. Corrective actions must be
            addressed and re-inspected before site mobilisation.
          </div>
        )}

        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700 dark:border-blue-800/40 dark:bg-blue-950/20 dark:text-blue-300">
          A PDF will be generated with all results and any evidence photos, and emailed to the
          Director and Safety Manager.
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-5 w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 sm:w-auto sm:px-8"
        >
          {pending ? "Submitting…" : "Submit and sign checklist"}
        </button>
      </section>
    </form>
  );
}
