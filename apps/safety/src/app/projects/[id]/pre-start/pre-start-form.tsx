"use client";

import { useActionState, useState, useRef, useEffect, useCallback } from "react";
import { HRW_CLASSIFICATIONS, PSYCH_HAZARDS } from "./constants";
import type { HRWFlag, PsychFlag, ConsultationPerson, ProjectComplexity } from "@/lib/pdf/pre-start-pdf";
import type { SubmitState, PreStartFormPayload, InternalSignOffEntry } from "./actions";

interface ProjectUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface Props {
  submitAction: (prev: SubmitState, fd: FormData) => Promise<SubmitState>;
  projectUsers: ProjectUser[];
  projectId: string;
}

const INTERNAL_ROLES = ["Project Manager", "Construction Manager", "Site Manager", "Director"] as const;
const RISK_LEVELS = ["Low", "Medium", "High", "Critical"] as const;
const CONSULT_METHODS = ["Site meeting", "Phone call", "Email", "Video call"] as const;
const RISK_COLOURS: Record<string, string> = {
  Low: "text-green-700 bg-green-50 border-green-200",
  Medium: "text-amber-700 bg-amber-50 border-amber-200",
  High: "text-orange-700 bg-orange-50 border-orange-200",
  Critical: "text-red-700 bg-red-50 border-red-200",
};

function initHRW(): HRWFlag[] {
  return HRW_CLASSIFICATIONS.map((c) => ({
    id: c.id,
    question: c.question,
    label: undefined,
    flagged: false,
    systemActions: c.systemActions,
    controlMeasures: "",
    responsiblePerson: "",
    pretickReason: undefined,
    untickJustification: "",
  }));
}

function initPsych(): PsychFlag[] {
  return PSYCH_HAZARDS.map((p) => ({
    id: p.id,
    label: p.label,
    question: p.question,
    flagged: false,
    controls: "",
    isMoreThanTraining: false,
  }));
}

function initConsultees(): ConsultationPerson[] {
  return [{ nameAndCompany: "", role: "", method: "Site meeting", datePerson: new Date().toISOString().split("T")[0], raised: "", decision: "" }];
}

// ── Signature canvas ──────────────────────────────────────────────────────────

function SignatureCanvas({ canvasRef, onClear }: { canvasRef: React.RefObject<HTMLCanvasElement | null>; onClear: () => void }) {
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
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
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

  function stop(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    isDrawing.current = false;
  }

  function handleClear() {
    initCanvas();
    onClear();
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
        onClick={handleClear}
        className="mt-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        Clear signature
      </button>
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

export function PreStartForm({ submitAction, projectUsers, projectId }: Props) {
  const [state, formAction, pending] = useActionState(submitAction, {});

  const today = new Date().toISOString().split("T")[0];
  const [assessmentDate, setAssessmentDate] = useState(today);

  // Project Complexities
  const [complexities, setComplexities] = useState<ProjectComplexity[]>([]);

  // HRW
  const [hrwFlags, setHrwFlags] = useState<HRWFlag[]>(initHRW);

  // Psych
  const [psychFlags, setPsychFlags] = useState<PsychFlag[]>(initPsych);
  const [psychHierarchyDeclaration, setPsychHierarchyDeclaration] = useState(false);

  // Consultation
  const [consultationPersons, setConsultationPersons] = useState<ConsultationPerson[]>(initConsultees);
  const [consultationDeclaration, setConsultationDeclaration] = useState(false);

  // Sign-off
  const [signOffUserId, setSignOffUserId] = useState(projectUsers[0]?.id ?? "");
  const signOffName = projectUsers.find((u) => u.id === signOffUserId)?.name ?? projectUsers.find((u) => u.id === signOffUserId)?.email ?? "";
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Panel A — internal sign-off
  const [internalNames, setInternalNames] = useState<string[]>(INTERNAL_ROLES.map(() => ""));
  const internalCanvasRef0 = useRef<HTMLCanvasElement>(null);
  const internalCanvasRef1 = useRef<HTMLCanvasElement>(null);
  const internalCanvasRef2 = useRef<HTMLCanvasElement>(null);
  const internalCanvasRef3 = useRef<HTMLCanvasElement>(null);
  const internalCanvasRefs = [internalCanvasRef0, internalCanvasRef1, internalCanvasRef2, internalCanvasRef3];

  const [clientError, setClientError] = useState<string | null>(null);

  // ── Complexity helpers ────────────────────────────────────────────────────

  function addComplexity() {
    setComplexities((prev) => [...prev, { description: "", riskLevel: "Low", safetyPlanning: "", triggersHrw: false, hrwClassificationId: undefined }]);
  }

  function removeComplexity(i: number) {
    setComplexities((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      // re-derive HRW pre-ticks
      applyComplexityPreticks(next);
      return next;
    });
  }

  function updateComplexity(i: number, patch: Partial<ProjectComplexity>) {
    setComplexities((prev) => {
      const next = prev.map((c, idx) => idx === i ? { ...c, ...patch } : c);
      applyComplexityPreticks(next);
      return next;
    });
  }

  function applyComplexityPreticks(comps: ProjectComplexity[]) {
    setHrwFlags((prev) =>
      prev.map((f) => {
        const triggering = comps.find((c) => c.triggersHrw && c.hrwClassificationId === f.id);
        if (triggering) {
          return { ...f, flagged: true, pretickReason: triggering.description };
        }
        // Only clear pretick if it was set by complexity (not manually ticked)
        if (f.pretickReason !== undefined && !comps.some((c) => c.triggersHrw && c.hrwClassificationId === f.id)) {
          return { ...f, pretickReason: undefined };
        }
        return f;
      }),
    );
  }

  // ── HRW helpers ───────────────────────────────────────────────────────────

  function setHRW(id: string, patch: Partial<HRWFlag>) {
    setHrwFlags((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function toggleHRW(id: string, value: boolean) {
    const flag = hrwFlags.find((f) => f.id === id);
    if (flag?.pretickReason && !value) {
      // Un-ticking a pre-ticked item: require justification but allow toggle via the expand panel
      setHRW(id, { flagged: false });
    } else {
      setHRW(id, { flagged: value, controlMeasures: value ? flag?.controlMeasures ?? "" : "", responsiblePerson: value ? flag?.responsiblePerson ?? "" : "" });
    }
  }

  // ── Psych helpers ─────────────────────────────────────────────────────────

  function setPsych(id: string, patch: Partial<PsychFlag>) {
    setPsychFlags((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  // ── AI guidance state ─────────────────────────────────────────────────────

  const [hrwGuidance, setHrwGuidance] = useState<Record<string, { loading: boolean; text: string }>>({});
  const [psychGuidance, setPsychGuidance] = useState<Record<string, { loading: boolean; text: string }>>({});
  const [consultGuidance, setConsultGuidance] = useState<Record<number, { loading: boolean; text: string }>>({});

  async function fetchHrwGuidance(id: string, label: string, question: string) {
    if (!navigator.onLine) {
      setHrwGuidance((prev) => ({ ...prev, [id]: { loading: false, text: "AI guidance requires an internet connection." } }));
      return;
    }
    setHrwGuidance((prev) => ({ ...prev, [id]: { loading: true, text: "" } }));
    try {
      const res = await fetch("/api/ai-guidance/hrw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, question }),
      });
      if (!res.ok || !res.body) throw new Error("Request failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setHrwGuidance((prev) => ({ ...prev, [id]: { loading: false, text: accumulated } }));
      }
    } catch {
      setHrwGuidance((prev) => ({ ...prev, [id]: { loading: false, text: "Unable to generate guidance. Please consult your Safety Manager." } }));
    }
  }

  async function fetchConsultGuidance(index: number, role: string) {
    if (!navigator.onLine) {
      setConsultGuidance((prev) => ({ ...prev, [index]: { loading: false, text: "AI guidance requires an internet connection." } }));
      return;
    }
    setConsultGuidance((prev) => ({ ...prev, [index]: { loading: true, text: "" } }));
    const hrwItems = hrwFlags.filter((f) => f.flagged).map((f) => {
      const spec = HRW_CLASSIFICATIONS.find((h) => h.id === f.id);
      return spec?.label ?? f.id;
    });
    const psychItems = psychFlags.filter((f) => f.flagged).map((f) => f.label ?? f.id);
    try {
      const res = await fetch("/api/ai-guidance/consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, hrwItems, psychItems }),
      });
      if (!res.ok || !res.body) throw new Error("Request failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setConsultGuidance((prev) => ({ ...prev, [index]: { loading: false, text: accumulated } }));
      }
    } catch {
      setConsultGuidance((prev) => ({ ...prev, [index]: { loading: false, text: "Unable to generate suggestions." } }));
    }
  }

  async function fetchPsychGuidance(id: string, label: string, question: string) {
    if (!navigator.onLine) {
      setPsychGuidance((prev) => ({ ...prev, [id]: { loading: false, text: "AI guidance requires an internet connection." } }));
      return;
    }
    setPsychGuidance((prev) => ({ ...prev, [id]: { loading: true, text: "" } }));
    try {
      const res = await fetch("/api/ai-guidance/psych", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, question }),
      });
      if (!res.ok || !res.body) throw new Error("Request failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setPsychGuidance((prev) => ({ ...prev, [id]: { loading: false, text: accumulated } }));
      }
    } catch {
      setPsychGuidance((prev) => ({ ...prev, [id]: { loading: false, text: "Unable to generate guidance. Please consult your Safety Manager." } }));
    }
  }

  // ── Consultation helpers ──────────────────────────────────────────────────

  function addConsultee() {
    setConsultationPersons((prev) => [
      ...prev,
      { nameAndCompany: "", role: "", method: "Site meeting", datePerson: today, raised: "", decision: "" },
    ]);
  }

  function removeConsultee(i: number) {
    setConsultationPersons((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateConsultee(i: number, patch: Partial<ConsultationPerson>) {
    setConsultationPersons((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function validate(): string | null {
    if (!assessmentDate) return "Assessment date is required.";
    if (!signOffName) return "Please select a sign-off person.";

    for (const c of complexities) {
      if (!c.description.trim()) return "All complexity items must have a description.";
      if (!c.safetyPlanning.trim()) return "All complexity items must have safety planning details.";
    }

    for (const f of hrwFlags) {
      if (f.flagged) {
        if (!f.controlMeasures?.trim()) return `Control measures required for: "${(f.question ?? "").slice(0, 60)}…"`;
        if (!f.responsiblePerson?.trim()) return `Responsible person required for: "${(f.question ?? "").slice(0, 60)}…"`;
      }
    }

    for (const f of psychFlags) {
      if (f.flagged && !f.controls.trim()) return `Control measures required for: "${f.label}"`;
    }
    if (psychFlags.some((f) => f.flagged) && !psychHierarchyDeclaration) {
      return "You must confirm controls go beyond information/training alone (VIC OHS Psychological Health Regs 2025).";
    }

    if (consultationPersons.length === 0) return "At least one consultation record is required.";
    for (const p of consultationPersons) {
      if (!p.nameAndCompany.trim()) return "All consultation records must have a name and company.";
      if (!p.role.trim()) return "All consultation records must have a role.";
      if (!p.raised.trim()) return "All consultation records must have 'what was raised'.";
      if (!p.decision.trim()) return "All consultation records must have 'what was decided'.";
    }
    if (!consultationDeclaration) return "You must confirm the consultation declaration before sign-off.";

    // Check Panel A internal signatures
    for (let i = 0; i < INTERNAL_ROLES.length; i++) {
      if (!internalNames[i]?.trim()) return `Name required for Panel A signatory: ${INTERNAL_ROLES[i]}`;
      const ic = internalCanvasRefs[i].current;
      if (ic) {
        const ctx = ic.getContext("2d");
        if (ctx) {
          const data = ctx.getImageData(0, 0, ic.width, ic.height).data;
          const hasSig = Array.from(data).some((v, j) => j % 4 !== 3 && v < 200);
          if (!hasSig) return `Signature required for Panel A: ${INTERNAL_ROLES[i]}`;
        }
      }
    }

    // Check signature has been drawn
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

    const signatureDataUrl = canvasRef.current?.toDataURL("image/png") ?? undefined;
    const internalSignoffs: InternalSignOffEntry[] = INTERNAL_ROLES.map((role, i) => ({
      role,
      name: internalNames[i] ?? "",
      signatureDataUrl: internalCanvasRefs[i].current?.toDataURL("image/png") ?? "",
    }));
    const payload: PreStartFormPayload = {
      assessmentDate,
      projectComplexities: complexities,
      hrwFlags,
      psychFlags: psychFlags.map((f) => ({ ...f, isMoreThanTraining: psychHierarchyDeclaration })),
      psychHierarchyDeclaration,
      consultationPersons,
      consultationDeclaration,
      internalSignoffs,
      signOffDropdownUserId: signOffUserId,
      signatureDataUrl,
    };
    const hidden = (e.currentTarget as HTMLFormElement).elements.namedItem("payload") as HTMLInputElement | null;
    if (hidden) hidden.value = JSON.stringify(payload);
  }

  const flaggedHRW = hrwFlags.filter((f) => f.flagged).length;
  const flaggedPsych = psychFlags.filter((f) => f.flagged).length;
  const error = clientError ?? state.error;

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-10">
      <input type="hidden" name="payload" defaultValue="" />

      {error && (
        <div id="form-error" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {/* ── Assessment date ────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Assessment date</h2>
        <p className="mt-1 text-sm text-zinc-500">Complete one week prior to site establishment.</p>
        <input
          type="date"
          value={assessmentDate}
          onChange={(e) => setAssessmentDate(e.target.value)}
          className="mt-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          required
        />
      </section>

      {/* ── Project Complexities ──────────────────────────────────────────── */}
      <section>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Project Complexities</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Document project-specific hazards and complexities. Items linked to an HRW classification will pre-populate Part 1.
            </p>
          </div>
          {complexities.length > 0 && (
            <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {complexities.length} item{complexities.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {complexities.map((c, i) => (
            <div key={i} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-zinc-500">Complexity {i + 1}</span>
                <button type="button" onClick={() => removeComplexity(i)} className="text-xs text-zinc-400 hover:text-red-600">
                  Remove
                </button>
              </div>
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Description <span className="text-red-500">*</span></span>
                  <textarea
                    value={c.description}
                    onChange={(e) => updateComplexity(i, { description: e.target.value })}
                    rows={2}
                    placeholder="What is the complexity? (e.g. Facade glazing to Level 12, external scaffold required)"
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Risk level <span className="text-red-500">*</span></span>
                    <select
                      value={c.riskLevel}
                      onChange={(e) => updateComplexity(i, { riskLevel: e.target.value as ProjectComplexity["riskLevel"] })}
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    >
                      {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                  <div>
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Risk level indicator</span>
                    <div className={`mt-1 rounded-lg border px-3 py-2 text-xs font-medium ${RISK_COLOURS[c.riskLevel]}`}>
                      {c.riskLevel}
                    </div>
                  </div>
                </div>
                <label className="block">
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Specific safety planning required <span className="text-red-500">*</span></span>
                  <textarea
                    value={c.safetyPlanning}
                    onChange={(e) => updateComplexity(i, { safetyPlanning: e.target.value })}
                    rows={2}
                    placeholder="What specific safety planning is required for this complexity?"
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                </label>
                <div>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={c.triggersHrw}
                      onChange={(e) => updateComplexity(i, { triggersHrw: e.target.checked, hrwClassificationId: e.target.checked ? c.hrwClassificationId : undefined })}
                      className="h-4 w-4 accent-zinc-700"
                    />
                    <span className="text-xs text-zinc-700 dark:text-zinc-300">Does this trigger a High Risk Work classification?</span>
                  </label>
                  {c.triggersHrw && (
                    <select
                      value={c.hrwClassificationId ?? ""}
                      onChange={(e) => updateComplexity(i, { hrwClassificationId: e.target.value || undefined })}
                      className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    >
                      <option value="">— Select HRW classification —</option>
                      {HRW_CLASSIFICATIONS.map((h) => (
                        <option key={h.id} value={h.id}>{h.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addComplexity}
          className="mt-3 rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:hover:border-zinc-500"
        >
          + Add complexity item
        </button>

        {complexities.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 dark:border-amber-800/30 dark:bg-amber-950/10">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
              Site-specific induction may need updating
            </p>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
              One or more project complexities may require your site-specific induction to be updated. Review your induction content after completing this assessment.
            </p>
            <a
              href={`/projects/${projectId}/induction/builder`}
              className="mt-2 inline-block text-xs font-medium text-amber-800 underline hover:text-amber-900 dark:text-amber-300"
            >
              Review induction builder →
            </a>
          </div>
        )}
      </section>

      {/* ── Part 1: HRW Classifications ─────────────────────────────────────── */}
      <section>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Part 1 — High-Risk Work Classifications</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Victorian OHS Regulations 2017 Schedule 1. Answer Yes or No for each classification.
              When Yes: describe the specific controls and who is responsible.
            </p>
          </div>
          {flaggedHRW > 0 && (
            <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
              {flaggedHRW} identified
            </span>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {hrwFlags.map((item, i) => {
            const spec = HRW_CLASSIFICATIONS.find((h) => h.id === item.id);
            return (
            <div key={item.id} className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-start gap-4 px-4 py-3">
                <span className="mt-0.5 w-5 shrink-0 text-xs text-zinc-400">{i + 1}</span>
                <div className="flex-1">
                  {spec && (
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{spec.label}</p>
                  )}
                  <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{item.question}</p>
                  {item.pretickReason && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      Pre-ticked — linked to complexity: &ldquo;{item.pretickReason.slice(0, 60)}&rdquo;
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-3">
                  <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name={`hrw-${item.id}`}
                      checked={!item.flagged}
                      onChange={() => toggleHRW(item.id, false)}
                      className="accent-zinc-600"
                    />
                    <span className="text-zinc-600 dark:text-zinc-400">No</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name={`hrw-${item.id}`}
                      checked={item.flagged}
                      onChange={() => toggleHRW(item.id, true)}
                      className="accent-red-600"
                    />
                    <span className={item.flagged ? "font-medium text-red-600 dark:text-red-400" : "text-zinc-600 dark:text-zinc-400"}>Yes</span>
                  </label>
                </div>
              </div>
              {item.flagged && (
                <div className="border-t border-zinc-100 bg-red-50/40 px-4 py-3 space-y-3 dark:border-zinc-700/50 dark:bg-red-950/10">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Recommended actions: <span className="font-normal">{item.systemActions}</span>
                    </p>
                    {!hrwGuidance[item.id] && (
                      <button
                        type="button"
                        onClick={() => fetchHrwGuidance(item.id, spec?.label ?? item.id, item.question ?? "")}
                        className="shrink-0 rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 dark:border-violet-700/40 dark:bg-violet-950/20 dark:text-violet-300 dark:hover:bg-violet-950/40"
                      >
                        ✦ AI guidance
                      </button>
                    )}
                  </div>
                  {hrwGuidance[item.id] && (
                    <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-3 dark:border-violet-700/40 dark:bg-violet-950/20">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">
                          ✦ AI guidance — VIC OHS Regs 2017 Sch 1
                        </p>
                        <button
                          type="button"
                          onClick={() => setHrwGuidance((prev) => { const n = { ...prev }; delete n[item.id]; return n; })}
                          className="text-xs text-violet-400 hover:text-violet-600 dark:hover:text-violet-200"
                        >
                          Dismiss
                        </button>
                      </div>
                      {hrwGuidance[item.id].loading && !hrwGuidance[item.id].text ? (
                        <p className="text-xs text-violet-500 dark:text-violet-400 animate-pulse">Generating guidance…</p>
                      ) : (
                        <p className="whitespace-pre-wrap text-xs text-violet-800 dark:text-violet-200 leading-relaxed">
                          {hrwGuidance[item.id].text}
                        </p>
                      )}
                    </div>
                  )}
                  <label className="block">
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Describe the specific control measures for this project <span className="text-red-500">*</span>
                    </span>
                    <textarea
                      value={item.controlMeasures ?? ""}
                      onChange={(e) => setHRW(item.id, { controlMeasures: e.target.value })}
                      rows={2}
                      placeholder="How will this risk be controlled on this specific project?"
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Who is responsible for implementing these controls? <span className="text-red-500">*</span>
                    </span>
                    <input
                      type="text"
                      value={item.responsiblePerson ?? ""}
                      onChange={(e) => setHRW(item.id, { responsiblePerson: e.target.value })}
                      placeholder="Name and role (e.g. John Smith — Site Manager)"
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    />
                  </label>
                  {item.pretickReason && (
                    <label className="block">
                      <span className="text-xs font-medium text-zinc-500">Justification if un-ticking (optional)</span>
                      <input
                        type="text"
                        value={item.untickJustification ?? ""}
                        onChange={(e) => setHRW(item.id, { untickJustification: e.target.value })}
                        placeholder="Reason this HRW classification does not apply despite linked complexity"
                        className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          );
          })}
        </div>
      </section>

      {/* ── Part 2: Psychosocial Hazards ────────────────────────────────────── */}
      <section>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Part 2 — Psychosocial Hazard Identification</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Victorian OHS (Psychological Health) Regulations 2025 — legally required from 1 December 2025.
              Answer Yes or No for each hazard type. Controls must follow the elimination hierarchy.
            </p>
          </div>
          {flaggedPsych > 0 && (
            <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              {flaggedPsych} identified
            </span>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {psychFlags.map((item, i) => {
            const spec = PSYCH_HAZARDS.find((p) => p.id === item.id);
            return (
              <div key={item.id} className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-start gap-4 px-4 py-3">
                  <span className="mt-0.5 w-5 shrink-0 text-xs text-zinc-400">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{item.label ?? spec?.label}</p>
                    <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{item.question ?? spec?.question}</p>
                  </div>
                  <div className="flex shrink-0 gap-3">
                    <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                      <input
                        type="radio"
                        name={`psych-${item.id}`}
                        checked={!item.flagged}
                        onChange={() => setPsych(item.id, { flagged: false, controls: "" })}
                        className="accent-zinc-600"
                      />
                      <span className="text-zinc-600 dark:text-zinc-400">No</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                      <input
                        type="radio"
                        name={`psych-${item.id}`}
                        checked={item.flagged}
                        onChange={() => setPsych(item.id, { flagged: true })}
                        className="accent-amber-600"
                      />
                      <span className={item.flagged ? "font-medium text-amber-600 dark:text-amber-400" : "text-zinc-600 dark:text-zinc-400"}>Yes</span>
                    </label>
                  </div>
                </div>

                {item.flagged && (
                  <div className="border-t border-zinc-100 px-4 pb-4 pt-3 dark:border-zinc-700/50">
                    <label className="block">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          Control measures applied <span className="text-red-500">*</span>
                        </span>
                        {!psychGuidance[item.id] && (
                          <button
                            type="button"
                            onClick={() => fetchPsychGuidance(item.id, item.label ?? spec?.label ?? item.id, item.question ?? spec?.question ?? "")}
                            className="shrink-0 rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 dark:border-violet-700/40 dark:bg-violet-950/20 dark:text-violet-300 dark:hover:bg-violet-950/40"
                          >
                            ✦ AI guidance
                          </button>
                        )}
                      </div>
                      {psychGuidance[item.id] && (
                        <div className="mt-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-3 dark:border-violet-700/40 dark:bg-violet-950/20">
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">
                              ✦ AI guidance — VIC Psych Safety Regs 2025
                            </p>
                            <button
                              type="button"
                              onClick={() => setPsychGuidance((prev) => { const n = { ...prev }; delete n[item.id]; return n; })}
                              className="text-xs text-violet-400 hover:text-violet-600 dark:hover:text-violet-200"
                            >
                              Dismiss
                            </button>
                          </div>
                          {psychGuidance[item.id].loading && !psychGuidance[item.id].text ? (
                            <p className="text-xs text-violet-500 dark:text-violet-400 animate-pulse">Generating guidance…</p>
                          ) : (
                            <p className="whitespace-pre-wrap text-xs text-violet-800 dark:text-violet-200 leading-relaxed">
                              {psychGuidance[item.id].text}
                            </p>
                          )}
                        </div>
                      )}
                      {spec?.controlPrompt && (
                        <p className="mt-0.5 text-xs text-zinc-500 italic">{spec.controlPrompt}</p>
                      )}
                      <textarea
                        value={item.controls}
                        onChange={(e) => setPsych(item.id, { controls: e.target.value })}
                        rows={3}
                        placeholder="Describe the controls that will be applied…"
                        className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {flaggedPsych > 0 && (
          <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 p-3 dark:border-amber-800/30 dark:bg-amber-950/10">
            <input
              type="checkbox"
              checked={psychHierarchyDeclaration}
              onChange={(e) => setPsychHierarchyDeclaration(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-amber-600"
            />
            <span className="text-xs text-zinc-700 dark:text-zinc-300">
              <span className="font-medium">Required:</span> I confirm that the controls recorded above go beyond information and training alone,
              in accordance with the Victorian OHS (Psychological Health) Regulations 2025.
            </span>
          </label>
        )}
      </section>

      {/* ── Part 3: Consultation Record ─────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Part 3 — Consultation Record</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Victorian OHS Act 2004 — Section 35 consultation obligation. Before submitting this assessment,
          you must consult with the people whose work will be affected by the risks identified above.
          Record who you spoke to, what they raised, and what you decided.
        </p>
        <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700 dark:border-blue-800/30 dark:bg-blue-950/10 dark:text-blue-300">
          <strong>Who must be consulted:</strong> Project Manager or Construction Manager, Site Supervisor (if appointed),
          lead supervisor of each major subcontractor trade on this project, Health and Safety Representative (if one exists).
        </div>

        <div className="mt-4 space-y-4">
          {consultationPersons.map((p, i) => (
            <div key={i} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-zinc-500">Person {i + 1}</span>
                {consultationPersons.length > 1 && (
                  <button type="button" onClick={() => removeConsultee(i)} className="text-xs text-zinc-400 hover:text-red-600">
                    Remove
                  </button>
                )}
              </div>
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Name and company <span className="text-red-500">*</span></span>
                    <input
                      type="text"
                      value={p.nameAndCompany}
                      onChange={(e) => updateConsultee(i, { nameAndCompany: e.target.value })}
                      placeholder="e.g. John Smith — Agero Group"
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Role on this project <span className="text-red-500">*</span></span>
                    <input
                      type="text"
                      value={p.role}
                      onChange={(e) => updateConsultee(i, { role: e.target.value })}
                      placeholder="e.g. Site Manager"
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Method of consultation</span>
                    <select
                      value={p.method}
                      onChange={(e) => updateConsultee(i, { method: e.target.value as ConsultationPerson["method"] })}
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    >
                      {CONSULT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Date consulted</span>
                    <input
                      type="date"
                      value={p.datePerson}
                      onChange={(e) => updateConsultee(i, { datePerson: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    />
                  </label>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      What did they raise? <span className="text-red-500">*</span>
                    </span>
                    {!consultGuidance[i] && (
                      <button
                        type="button"
                        onClick={() => fetchConsultGuidance(i, p.role)}
                        className="shrink-0 rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 dark:border-violet-700/40 dark:bg-violet-950/20 dark:text-violet-300 dark:hover:bg-violet-950/40"
                      >
                        ✦ Suggest points
                      </button>
                    )}
                  </div>
                  {consultGuidance[i] && (
                    <div className="mb-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-3 dark:border-violet-700/40 dark:bg-violet-950/20">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">✦ Suggested consultation points</p>
                        <button
                          type="button"
                          onClick={() => setConsultGuidance((prev) => { const n = { ...prev }; delete n[i]; return n; })}
                          className="text-xs text-violet-400 hover:text-violet-600 dark:hover:text-violet-200"
                        >
                          Dismiss
                        </button>
                      </div>
                      {consultGuidance[i].loading && !consultGuidance[i].text ? (
                        <p className="text-xs text-violet-500 animate-pulse">Generating suggestions…</p>
                      ) : (
                        <p className="whitespace-pre-wrap text-xs text-violet-800 dark:text-violet-200 leading-relaxed">{consultGuidance[i].text}</p>
                      )}
                    </div>
                  )}
                  <textarea
                    value={p.raised}
                    onChange={(e) => updateConsultee(i, { raised: e.target.value })}
                    rows={2}
                    placeholder="Issues, concerns, or suggestions raised…"
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                </div>
                <label className="block">
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    What was decided in response? <span className="text-red-500">*</span>
                  </span>
                  <textarea
                    value={p.decision}
                    onChange={(e) => updateConsultee(i, { decision: e.target.value })}
                    rows={2}
                    placeholder="Accepted / not accepted / modified, with reason…"
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addConsultee}
          className="mt-3 rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:hover:border-zinc-500"
        >
          + Add another person consulted
        </button>

        <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/50">
          <input
            type="checkbox"
            checked={consultationDeclaration}
            onChange={(e) => setConsultationDeclaration(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-zinc-700"
          />
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            <span className="font-medium">Required:</span> I confirm that I consulted with the persons listed above before completing this assessment.
            Their views were shared before I made decisions about risk controls.
            This consultation was genuine and not a formality.
          </span>
        </label>
      </section>

      {/* ── Panel A: Internal Sign-Off ──────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Panel A — Internal Sign-Off</h2>
        <p className="mt-1 text-sm text-zinc-500">
          All four Agero Group personnel must sign to confirm they have reviewed and approved this assessment before submission.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {INTERNAL_ROLES.map((role, i) => (
            <div key={role} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">{role} <span className="text-red-500">*</span></p>
              <label className="block mb-3">
                <span className="text-xs text-zinc-500">Full name</span>
                <input
                  type="text"
                  value={internalNames[i] ?? ""}
                  onChange={(e) => setInternalNames((prev) => { const n = [...prev]; n[i] = e.target.value; return n; })}
                  placeholder={`Name of ${role}`}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </label>
              <p className="text-xs text-zinc-500 mb-1">Signature</p>
              <SignatureCanvas canvasRef={internalCanvasRefs[i]} onClear={() => {}} />
            </div>
          ))}
        </div>
      </section>

      {/* ── Sign-off ─────────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Sign-off</h2>
        <p className="mt-1 text-sm text-zinc-500">
          By signing this assessment you confirm the information is accurate and all identified
          hazards have been assessed in accordance with ISO 45001:2018 Clause 6.1.
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
                  <option key={u.id} value={u.id}>
                    {u.name ?? u.email}
                  </option>
                ))
              )}
            </select>
          </label>

          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Signature <span className="text-red-500">*</span>
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">Sign using your finger (mobile) or mouse (desktop). Tap Clear to redo.</p>
            <div className="mt-2">
              <SignatureCanvas canvasRef={canvasRef} onClear={() => {}} />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Date &amp; time</p>
            <p className="mt-1 rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800">
              Set automatically on submission
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700 dark:border-blue-800/40 dark:bg-blue-950/20 dark:text-blue-300">
          A PDF will be generated and emailed to the Director and Safety Manager. The Site
          Preparation Checklist will be unlocked after sign-off.
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-5 w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 sm:w-auto sm:px-8"
        >
          {pending ? "Submitting…" : "Submit and sign assessment"}
        </button>
      </section>
    </form>
  );
}
