"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { createStorageAdminClient } from "@/lib/supabase/server";
import { sendSitePrepChecklistEmail } from "@/lib/email";
import { generateSitePrepPdf } from "@/lib/pdf/site-prep-pdf";
import type { SectionResult } from "@/lib/pdf/site-prep-pdf";

export interface SitePrepPayload {
  completionDate: string;
  sections: SectionResult[];
  signOffDropdownUserId: string;
  signatureDataUrl?: string;
}

export interface SubmitState {
  error?: string;
}

export async function uploadChecklistPhoto(
  formData: FormData,
): Promise<{ url?: string; error?: string }> {
  await requireRole(AGERO_ROLES);

  const file = formData.get("file") as File | null;
  const safetyProjectId = formData.get("safetyProjectId")?.toString();
  const sectionId = formData.get("sectionId")?.toString();

  if (!file || !safetyProjectId || !sectionId) return { error: "Missing upload data." };
  if (!file.type.startsWith("image/")) return { error: "File must be an image." };
  if (file.size > 10 * 1024 * 1024) return { error: "Image must be under 10 MB." };

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id: safetyProjectId },
    select: { id: true },
  });
  if (!safetyProject) return { error: "Project not found." };

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `site-prep/photos/${safetyProjectId}/${sectionId}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const storage = createStorageAdminClient();
  const { error: uploadError } = await storage
    .from("documents")
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("[sitePrepPhoto] Upload error:", uploadError.message);
    return { error: "Photo upload failed." };
  }

  const { data } = storage.from("documents").getPublicUrl(path);
  return { url: data.publicUrl };
}

export async function submitSitePrepChecklist(
  safetyProjectId: string,
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const user = await requireRole(AGERO_ROLES);

  const raw = formData.get("payload")?.toString();
  if (!raw) return { error: "Form data missing." };

  let payload: SitePrepPayload;
  try {
    payload = JSON.parse(raw) as SitePrepPayload;
  } catch {
    return { error: "Invalid form data." };
  }

  const { completionDate, sections, signOffDropdownUserId, signatureDataUrl } = payload;

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!completionDate) return { error: "Completion date is required." };
  if (!signOffDropdownUserId) return { error: "Please select a sign-off person." };

  const unanswered = sections.filter((s) => !s.answer);
  if (unanswered.length > 0) {
    return { error: `${unanswered.length} section${unanswered.length !== 1 ? "s" : ""} have not been answered.` };
  }

  const noWithoutNote = sections.filter((s) => s.answer === "NO" && !s.note?.trim());
  if (noWithoutNote.length > 0) {
    return {
      error: `A note is required for all NO sections: ${noWithoutNote.map((s) => s.sectionName).join(", ")}.`,
    };
  }

  const noWithoutPhoto = sections.filter((s) => s.answer === "NO" && !s.photoUrl);
  if (noWithoutPhoto.length > 0) {
    return {
      error: `A photo is required for all NO sections: ${noWithoutPhoto.map((s) => s.sectionName).join(", ")}.`,
    };
  }

  // ── Load sign-off user ─────────────────────────────────────────────────────
  const signOffUser = await prisma.user.findUnique({
    where: { id: signOffDropdownUserId },
    select: { name: true, email: true },
  });
  if (!signOffUser) return { error: "Selected sign-off user not found." };
  const managerSignOffName = signOffUser.name ?? signOffUser.email;

  // ── Load project, verify Phase 1 plan exists ───────────────────────────────
  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id: safetyProjectId },
    include: {
      preStartAssessments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true },
      },
      sitePreparationPlan: {
        select: { id: true, status: true, sections: true },
      },
    },
  });
  if (!safetyProject) return { error: "Project not found." };
  if (safetyProject.preStartAssessments.length === 0) {
    return { error: "Pre-Start Risk Assessment must be completed before submitting the checklist." };
  }
  if (!safetyProject.sitePreparationPlan || safetyProject.sitePreparationPlan.status !== "COMPLETE") {
    return { error: "Phase 1 Site Preparation Plan must be signed off before submitting the checklist." };
  }

  const planId = safetyProject.sitePreparationPlan.id;
  const planSections = safetyProject.sitePreparationPlan.sections as Array<{
    sectionId: string;
    sectionName: string;
    planNote: string;
    plannedCompletionDate: string;
  }>;

  const managerSignOffAt = new Date();

  // ── Upload signature ───────────────────────────────────────────────────────
  let signatureUrl: string | null = null;
  if (signatureDataUrl) {
    try {
      const base64 = signatureDataUrl.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64, "base64");
      const storage = createStorageAdminClient();
      const path = `site-prep/signatures/checklist-${safetyProjectId}-${Date.now()}.png`;
      const { error: uploadError } = await storage
        .from("documents")
        .upload(path, buffer, { contentType: "image/png", upsert: false });
      if (!uploadError) {
        const { data } = storage.from("documents").getPublicUrl(path);
        signatureUrl = data.publicUrl;
      }
    } catch (e) {
      console.error("[sitePrep] Signature upload error:", e);
    }
  }

  // ── Generate PDF ───────────────────────────────────────────────────────────
  let pdfUrl: string | null = null;
  try {
    const pdfBuffer = await generateSitePrepPdf({
      projectName: safetyProject.name,
      projectAddress: safetyProject.address,
      completionDate,
      sections,
      planSections,
      managerSignOffName,
      managerSignOffAt,
      signatureUrl: signatureUrl ?? undefined,
    });

    const storage = createStorageAdminClient();
    const path = `site-prep/${safetyProjectId}-${Date.now()}.pdf`;
    const { error: uploadError } = await storage
      .from("documents")
      .upload(path, pdfBuffer, { contentType: "application/pdf", upsert: false });

    if (!uploadError) {
      const { data } = storage.from("documents").getPublicUrl(path);
      pdfUrl = data.publicUrl;
    } else {
      console.error("[sitePrep] PDF upload error:", uploadError.message);
    }
  } catch (e) {
    console.error("[sitePrep] PDF generation error:", e);
  }

  // ── Save record ────────────────────────────────────────────────────────────
  await prisma.sitePreparationChecklist.create({
    data: {
      projectId: safetyProjectId,
      planId,
      completedById: user.id,
      completionDate: new Date(completionDate),
      items: sections as object[],
      managerSignOffName,
      managerSignOffAt,
      signatureUrl,
      pdfUrl,
    },
  });

  // ── Email Director + Safety Managers ──────────────────────────────────────
  try {
    const managers = await prisma.user.findMany({
      where: { organisationId: user.organisationId, role: { in: ["admin", "safety_manager"] } },
      select: { email: true },
    });
    const recipients = Array.from(
      new Set(["bfernandez@agero.com.au", ...managers.map((m) => m.email)]),
    );
    await sendSitePrepChecklistEmail({
      to: recipients,
      projectName: safetyProject.name,
      completionDate: new Date(completionDate).toLocaleDateString("en-AU"),
      managerName: managerSignOffName,
      yesCount: sections.filter((s) => s.answer === "YES").length,
      noCount: sections.filter((s) => s.answer === "NO").length,
      naCount: sections.filter((s) => s.answer === "NA").length,
      pdfUrl,
    });
  } catch (e) {
    console.error("[sitePrep] Email error:", e);
  }

  redirect(`/projects/${safetyProjectId}/site-prep?done=1`);
}
