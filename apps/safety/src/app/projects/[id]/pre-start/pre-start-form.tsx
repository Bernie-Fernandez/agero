"use client";

import { useActionState, useState } from "react";
import { HRW_CLASSIFICATIONS, PSYCH_HAZARDS } from "./constants";
import type { HRWFlag, PsychFlag } from "@/lib/pdf/pre-start-pdf";
import type { SubmitState, PreStartFormPayload } from "./actions";

interface Props {
  safetyProjectId: string;
  submitAction: (prev: SubmitState, fd: FormData) => Promise<SubmitState>;
}

function initHRW(): HRWFlag[] {
  return HRW_CLASSIFICATIONS.map((c) => ({
    id: c.id,
    label: c.label,
    flagged: false,
    systemActions: c.systemActions,
  }));
}

function initPsych(): PsychFlag[] {
  return PSYCH_HAZARDS.map((p) => ({
    id: p.id,
    label: p.label,
    flagged: false,
    controls: "",
    isMoreThanTraining: false,
  }));
}

export function PreStartForm({ safetyProjectId, submitAction }: Props) {
  const [state, formAction, pending] = useActionState(submitAction, {});

  const today = new Date().toISOString().split("T")[0];
  const [assessmentDate, setAssessmentDate] = useState(today);
  const [hrwFlags, setHrwFlags] = useState<HRWFlag[]>(initHRW);
  const [psychFlags, setPsychFlags] = useState<PsychFlag[]>(initPsych);
  const [consultees, setConsultees] = useState("");
  const [raised, setRaised] = useState("");
  const [decision, setDecision] = useState("");
  const [signOffName, setSignOffName] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  function setHRW(id: string, patch: Partial<HRWFlag>) {
    setHrwFlags((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function setPsych(id: string, patch: Partial<PsychFlag>) {
    setPsychFlags((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function validate(): string | null {
    if (!assessmentDate) return "Assessment date is required.";
    if (!signOffName.trim()) return "Assessor name is required.";
    if (!consultees.trim()) return "Consultation record: please list who was consulted.";
    if (!raised.trim()) return "Consultation record: please describe what was raised.";
    if (!decision.trim()) return "Consultation record: please state what decision was made.";
    for (const f of psychFlags) {
      if (f.flagged && !f.controls.trim())
        return `Control measures required for: "${f.label}".`;
      if (f.flagged && !f.isMoreThanTraining)
        return `For "${f.label}": information/training cannot be the only control. Confirm a higher-order control has been applied.`;
    }
    return null;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const err = validate();
    if (err) {
      e.preventDefault();
      setClientError(err);
      const el = document.getElementById("form-error");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      setClientError(null);
      // Inject payload JSON into the hidden input before native submit
      const payload: PreStartFormPayload = {
        assessmentDate,
        hrwFlags,
        psychFlags,
        consultees,
        raised,
        decision,
        signOffName,
      };
      const hidden = (e.currentTarget as HTMLFormElement).elements.namedItem(
        "payload",
      ) as HTMLInputElement | null;
      if (hidden) hidden.value = JSON.stringify(payload);
    }
  }

  const flaggedHRW = hrwFlags.filter((f) => f.flagged).length;
  const flaggedPsych = psychFlags.filter((f) => f.flagged).length;
  const error = clientError ?? state.error;

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-10">
      {/* Hidden payload input */}
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

      {/* ── Assessment date ────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Assessment date
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          This assessment should be completed one week prior to site establishment.
        </p>
        <input
          type="date"
          value={assessmentDate}
          onChange={(e) => setAssessmentDate(e.target.value)}
          className="mt-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          required
        />
      </section>

      {/* ── Section 1: High-Risk Work Classifications ───────────────────────── */}
      <section>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Part 1 — High-Risk Work Classifications
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Victorian OHS Regulations 2017 Schedule 1. Record whether each classification applies
              to this project.
            </p>
          </div>
          {flaggedHRW > 0 && (
            <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
              {flaggedHRW} identified
            </span>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {hrwFlags.map((item, i) => (
            <div
              key={item.id}
              className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center gap-4 px-4 py-3">
                <span className="w-5 shrink-0 text-xs text-zinc-400">{i + 1}</span>
                <p className="flex-1 text-sm text-zinc-800 dark:text-zinc-200">{item.label}</p>
                <div className="flex gap-3">
                  <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name={`hrw-${item.id}`}
                      checked={!item.flagged}
                      onChange={() => setHRW(item.id, { flagged: false })}
                      className="accent-zinc-600"
                    />
                    <span className="text-zinc-600 dark:text-zinc-400">No</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name={`hrw-${item.id}`}
                      checked={item.flagged}
                      onChange={() => setHRW(item.id, { flagged: true })}
                      className="accent-red-600"
                    />
                    <span className={item.flagged ? "font-medium text-red-600 dark:text-red-400" : "text-zinc-600 dark:text-zinc-400"}>
                      Yes
                    </span>
                  </label>
                </div>
              </div>
              {item.flagged && (
                <div className="border-t border-zinc-100 bg-red-50/50 px-4 py-3 dark:border-zinc-700/50 dark:bg-red-950/10">
                  <p className="text-xs font-medium text-red-700 dark:text-red-400">
                    Required actions:
                  </p>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {item.systemActions}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 2: Psychosocial Hazards ─────────────────────────────────── */}
      <section>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Part 2 — Psychosocial Hazard Identification
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Victorian OHS (Psychological Health) Regulations 2025 — legally required from 1 December
              2025. For each identified hazard, record the control measures applied. Controls must
              follow the elimination hierarchy; information/training cannot be the sole control.
            </p>
          </div>
          {flaggedPsych > 0 && (
            <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              {flaggedPsych} identified
            </span>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {psychFlags.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            >
              <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={item.flagged}
                  onChange={(e) => setPsych(item.id, { flagged: e.target.checked })}
                  className="h-4 w-4 accent-amber-600"
                />
                <span className={`text-sm ${item.flagged ? "font-medium text-zinc-900 dark:text-zinc-50" : "text-zinc-700 dark:text-zinc-300"}`}>
                  {item.label}
                </span>
              </label>

              {item.flagged && (
                <div className="border-t border-zinc-100 px-4 pb-4 pt-3 dark:border-zinc-700/50">
                  <label className="block">
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Control measures applied{" "}
                      <span className="text-red-500">*</span>
                    </span>
                    <textarea
                      value={item.controls}
                      onChange={(e) => setPsych(item.id, { controls: e.target.value })}
                      rows={3}
                      placeholder="Describe the controls applied (e.g. clear complaint procedure, regular check-ins, workload redistribution)…"
                      className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    />
                  </label>
                  <label className="mt-3 flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      checked={item.isMoreThanTraining}
                      onChange={(e) => setPsych(item.id, { isMoreThanTraining: e.target.checked })}
                      className="mt-0.5 h-4 w-4 accent-zinc-700"
                    />
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">
                      I confirm the control measures above go beyond information or training alone
                      (VIC OHS Psychological Health Regs 2025 — hierarchy requirement).
                    </span>
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 3: Consultation Record ──────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Part 3 — Consultation Record
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Victorian OHS Act 2004 — Section 35 consultation obligation. All three fields are
          mandatory before sign-off.
        </p>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Who was consulted{" "}
              <span className="font-normal text-zinc-400">(names and roles)</span>{" "}
              <span className="text-red-500">*</span>
            </span>
            <textarea
              value={consultees}
              onChange={(e) => setConsultees(e.target.value)}
              rows={2}
              placeholder="e.g. John Smith (Site Manager), Jane Doe (Safety Manager), Bob Builder (HSR)…"
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              What was raised <span className="text-red-500">*</span>
            </span>
            <textarea
              value={raised}
              onChange={(e) => setRaised(e.target.value)}
              rows={3}
              placeholder="Summarise the hazards, risks, or concerns raised during consultation…"
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              What decision was made <span className="text-red-500">*</span>
            </span>
            <textarea
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              rows={3}
              placeholder="Describe the agreed controls, actions, or outcomes from consultation…"
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
        </div>
      </section>

      {/* ── Sign-off ─────────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Sign-off</h2>
        <p className="mt-1 text-sm text-zinc-500">
          By signing this assessment you confirm the information is accurate and that all
          identified hazards have been assessed in accordance with ISO 45001:2018 Clause 6.1.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Assessor name <span className="text-red-500">*</span>
            </span>
            <input
              type="text"
              value={signOffName}
              onChange={(e) => setSignOffName(e.target.value)}
              placeholder="Full name"
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Date &amp; time</p>
            <p className="mt-1.5 rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800">
              Set automatically on submission
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700 dark:border-blue-800/40 dark:bg-blue-950/20 dark:text-blue-300">
          A PDF will be generated and emailed to the Director and Safety Manager. The Site
          Preparation Checklist will be unlocked for this project after sign-off.
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
