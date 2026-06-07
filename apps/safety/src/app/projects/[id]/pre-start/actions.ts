"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { createStorageAdminClient } from "@/lib/supabase/server";
import { sendPreStartAssessmentEmail } from "@/lib/email";
import { generatePreStartPdf } from "@/lib/pdf/pre-start-pdf";
import type { HRWFlag, PsychFlag } from "@/lib/pdf/pre-start-pdf";

export interface PreStartFormPayload {
  assessmentDate: string;
  hrwFlags: HRWFlag[];
  psychFlags: PsychFlag[];
  consultees: string;
  raised: string;
  decision: string;
  signOffName: string;
}

export interface SubmitState {
  error?: string;
}

export async function submitPreStartAssessment(
  safetyProjectId: string,
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const user = await requireRole(AGERO_ROLES);

  // Parse JSON payload from hidden input
  const raw = formData.get("payload")?.toString();
  if (!raw) return { error: "Form data missing." };

  let payload: PreStartFormPayload;
  try {
    payload = JSON.parse(raw) as PreStartFormPayload;
  } catch {
    return { error: "Invalid form data." };
  }

  const { assessmentDate, hrwFlags, psychFlags, consultees, raised, decision, signOffName } = payload;

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!assessmentDate) return { error: "Assessment date is required." };
  if (!signOffName.trim()) return { error: "Assessor name is required for sign-off." };
  if (!consultees.trim() || !raised.trim() || !decision.trim())
    return { error: "Consultation record must be fully completed before sign-off." };

  const incompletePsych = psychFlags.filter((f) => f.flagged && !f.controls.trim());
  if (incompletePsych.length > 0) {
    return {
      error: `Control measures required for: ${incompletePsych.map((f) => f.label).join(", ")}.`,
    };
  }
  const trainingOnlyPsych = psychFlags.filter((f) => f.flagged && !f.isMoreThanTraining);
  if (trainingOnlyPsych.length > 0) {
    return {
      error: `Information/training cannot be the only control for: ${trainingOnlyPsych.map((f) => f.label).join(", ")}. Apply a higher-order control first.`,
    };
  }

  // ── Load project ───────────────────────────────────────────────────────────
  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id: safetyProjectId },
  });
  if (!safetyProject) {
    return { error: "Project not found." };
  }

  const signOffAt = new Date();

  // ── Generate PDF ───────────────────────────────────────────────────────────
  let pdfUrl: string | null = null;
  try {
    const pdfBuffer = await generatePreStartPdf({
      projectName: safetyProject.name,
      projectAddress: safetyProject.address,
      assessmentDate,
      highRiskFlags: hrwFlags,
      psychosocialFlags: psychFlags,
      consultees,
      raised,
      decision,
      signOffName: signOffName.trim(),
      signOffAt,
    });

    const storage = createStorageAdminClient();
    const path = `pre-start/${safetyProjectId}-${Date.now()}.pdf`;
    const { error: uploadError } = await storage
      .from("documents")
      .upload(path, pdfBuffer, { contentType: "application/pdf", upsert: false });

    if (!uploadError) {
      const { data } = storage.from("documents").getPublicUrl(path);
      pdfUrl = data.publicUrl;
    } else {
      console.error("[preStartAssessment] PDF upload error:", uploadError.message);
    }
  } catch (e) {
    console.error("[preStartAssessment] PDF generation error:", e);
  }

  // ── Save record ────────────────────────────────────────────────────────────
  await prisma.preStartAssessment.create({
    data: {
      projectId: safetyProjectId,
      completedById: user.id,
      assessmentDate: new Date(assessmentDate),
      highRiskFlags: hrwFlags as object[],
      psychosocialFlags: psychFlags as object[],
      consultationRecord: JSON.stringify({ consultees, raised, decision }),
      signOffName: signOffName.trim(),
      signOffAt,
      pdfUrl,
    },
  });

  // ── Email Director + Safety Managers ─────────────────────────────────────
  try {
    const managers = await prisma.user.findMany({
      where: { organisationId: user.organisationId, role: { in: ["admin", "safety_manager"] } },
      select: { email: true },
    });
    const recipients = Array.from(
      new Set(["bfernandez@agero.com.au", ...managers.map((m) => m.email)]),
    );
    await sendPreStartAssessmentEmail({
      to: recipients,
      projectName: safetyProject.name,
      assessmentDate: new Date(assessmentDate).toLocaleDateString("en-AU"),
      assessorName: signOffName.trim(),
      hrwCount: hrwFlags.filter((f) => f.flagged).length,
      psychCount: psychFlags.filter((f) => f.flagged).length,
      pdfUrl,
    });
  } catch (e) {
    console.error("[preStartAssessment] Email error:", e);
  }

  redirect(`/projects/${safetyProjectId}/pre-start?done=1`);
}
