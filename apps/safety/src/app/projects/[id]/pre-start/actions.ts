"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { createStorageAdminClient } from "@/lib/supabase/server";
import { sendPreStartAssessmentEmail } from "@/lib/email";
import { generatePreStartPdf } from "@/lib/pdf/pre-start-pdf";
import type { HRWFlag, PsychFlag, ConsultationPerson, ProjectComplexity } from "@/lib/pdf/pre-start-pdf";

export interface InternalSignOffEntry {
  role: string;
  name: string;
  signatureDataUrl: string;
}

export interface PreStartFormPayload {
  assessmentDate: string;
  projectComplexities: ProjectComplexity[];
  hrwFlags: HRWFlag[];
  psychFlags: PsychFlag[];
  psychHierarchyDeclaration: boolean;
  consultationPersons: ConsultationPerson[];
  consultationDeclaration: boolean;
  internalSignoffs: InternalSignOffEntry[];
  signOffDropdownUserId: string;
  signatureDataUrl?: string;
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

  const raw = formData.get("payload")?.toString();
  if (!raw) return { error: "Form data missing." };

  let payload: PreStartFormPayload;
  try {
    payload = JSON.parse(raw) as PreStartFormPayload;
  } catch {
    return { error: "Invalid form data." };
  }

  const {
    assessmentDate,
    projectComplexities,
    hrwFlags,
    psychFlags,
    psychHierarchyDeclaration,
    consultationPersons,
    consultationDeclaration,
    internalSignoffs,
    signOffDropdownUserId,
    signatureDataUrl,
  } = payload;

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!assessmentDate) return { error: "Assessment date is required." };
  if (!signOffDropdownUserId) return { error: "Please select the person signing off." };

  // Resolve sign-off name server-side from the dropdown user ID
  const signOffUserRecord = await prisma.user.findUnique({
    where: { id: signOffDropdownUserId },
    select: { name: true, email: true },
  });
  if (!signOffUserRecord) return { error: "Selected sign-off user not found." };
  const signOffName = signOffUserRecord.name ?? signOffUserRecord.email;
  if (consultationPersons.length === 0)
    return { error: "At least one consultation record is required before sign-off." };
  for (const p of consultationPersons) {
    if (!p.nameAndCompany.trim() || !p.role.trim())
      return { error: "Each consultation record must have a name/company and role." };
    if (!p.raised.trim() || !p.decision.trim())
      return { error: "Each consultation record must have 'what was raised' and 'what was decided'." };
  }
  if (!consultationDeclaration)
    return { error: "You must confirm the consultation declaration before sign-off." };

  const missingInternalSig = internalSignoffs?.find((s) => !s.name.trim() || !s.signatureDataUrl);
  if (missingInternalSig || !internalSignoffs || internalSignoffs.length < 4)
    return { error: "All four Panel A internal signatories must provide their name and signature." };

  const incompletePsych = psychFlags.filter((f) => f.flagged && !f.controls.trim());
  if (incompletePsych.length > 0) {
    return {
      error: `Control measures required for: ${incompletePsych.map((f) => f.label).join(", ")}.`,
    };
  }
  const anyPsychFlagged = psychFlags.some((f) => f.flagged);
  if (anyPsychFlagged && !psychHierarchyDeclaration) {
    return {
      error:
        "You must confirm that controls go beyond information and training alone (VIC OHS Psychological Health Regs 2025).",
    };
  }

  const incompleteHRW = hrwFlags.filter((f) => f.flagged && !f.controlMeasures?.trim());
  if (incompleteHRW.length > 0) {
    return {
      error: `Control measures required for flagged HRW items: ${incompleteHRW.map((f) => f.question?.slice(0, 40) ?? f.id).join("; ")}.`,
    };
  }

  // ── Load project ───────────────────────────────────────────────────────────
  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id: safetyProjectId },
  });
  if (!safetyProject) return { error: "Project not found." };

  const signOffAt = new Date();

  // ── Upload signature image ─────────────────────────────────────────────────
  let signatureUrl: string | null = null;
  if (signatureDataUrl) {
    try {
      const base64Data = signatureDataUrl.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const storage = createStorageAdminClient();
      const sigPath = `pre-start/signatures/${safetyProjectId}-${Date.now()}.png`;
      const { error: uploadError } = await storage
        .from("documents")
        .upload(sigPath, buffer, { contentType: "image/png", upsert: false });
      if (!uploadError) {
        const { data } = storage.from("documents").getPublicUrl(sigPath);
        signatureUrl = data.publicUrl;
      }
    } catch (e) {
      console.error("[preStart] Signature upload error:", e);
    }
  }

  // ── Generate PDF ───────────────────────────────────────────────────────────
  let pdfUrl: string | null = null;
  try {
    const pdfBuffer = await generatePreStartPdf({
      projectName: safetyProject.name,
      projectAddress: safetyProject.address,
      assessmentDate,
      projectComplexities,
      highRiskFlags: hrwFlags,
      psychosocialFlags: psychFlags,
      consultationPersons,
      signOffName: signOffName.trim(),
      signatureUrl: signatureUrl ?? undefined,
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
      console.error("[preStart] PDF upload error:", uploadError.message);
    }
  } catch (e) {
    console.error("[preStart] PDF generation error:", e);
  }

  // ── Save record ────────────────────────────────────────────────────────────
  const assessment = await prisma.preStartAssessment.create({
    data: {
      projectId: safetyProjectId,
      completedById: user.id,
      assessmentDate: new Date(assessmentDate),
      projectComplexities: projectComplexities as object[],
      highRiskFlags: hrwFlags as object[],
      psychosocialFlags: psychFlags as object[],
      consultationRecord: JSON.stringify({ consultationPersons, consultationDeclaration }),
      signOffName: signOffName.trim(),
      signOffDropdownUserId: signOffDropdownUserId || null,
      signatureUrl,
      signOffAt,
      pdfUrl,
      internalSignoffsRequired: internalSignoffs.map((s) => s.role),
      allInternalSigned: true,
    },
  });

  // ── Upload and save internal sign-off signatures ───────────────────────────
  await Promise.all(internalSignoffs.map(async (entry, idx) => {
    let sigUrl = "";
    try {
      const base64Data = entry.signatureDataUrl.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const storage = createStorageAdminClient();
      const sigPath = `pre-start/internal-signoffs/${assessment.id}-${idx}-${Date.now()}.png`;
      const { error: uploadError } = await storage
        .from("documents")
        .upload(sigPath, buffer, { contentType: "image/png", upsert: false });
      if (!uploadError) {
        const { data } = storage.from("documents").getPublicUrl(sigPath);
        sigUrl = data.publicUrl;
      }
    } catch (e) {
      console.error("[preStart] Internal sig upload error:", e);
    }
    await prisma.internalSignOff.create({
      data: {
        preStartId: assessment.id,
        signatoryClerkId: user.clerkUserId ?? user.id,
        signatoryName: entry.name.trim(),
        signatoryRole: entry.role,
        signatureUrl: sigUrl,
        signedAt: signOffAt,
      },
    });
  }));

  // ── ConsultationEvent (fire-and-forget) ───────────────────────────────────
  prisma.consultationEvent.create({
    data: {
      projectId: safetyProjectId,
      eventType: "PRE_START_INTERNAL",
      referenceId: assessment.id,
      consultedPersons: consultationPersons.map((p) => ({ name: p.nameAndCompany, role: p.role })),
      notes: `Pre-Start Risk Assessment signed — ${internalSignoffs.map((s) => s.role).join(", ")}`,
      eventDate: signOffAt,
    },
  }).catch(() => {});

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
    console.error("[preStart] Email error:", e);
  }

  redirect(`/projects/${safetyProjectId}/pre-start?done=1`);
}
