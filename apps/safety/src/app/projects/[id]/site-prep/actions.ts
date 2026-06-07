"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { createStorageAdminClient } from "@/lib/supabase/server";
import { sendSitePrepChecklistEmail } from "@/lib/email";
import { generateSitePrepPdf } from "@/lib/pdf/site-prep-pdf";
import type { ChecklistItemResult } from "@/lib/pdf/site-prep-pdf";

export interface SitePrepPayload {
  completionDate: string;
  items: ChecklistItemResult[];
  managerSignOffName: string;
}

export interface SubmitState {
  error?: string;
}

export async function uploadChecklistPhoto(
  formData: FormData,
): Promise<{ url?: string; error?: string }> {
  const user = await requireRole(AGERO_ROLES);

  const file = formData.get("file") as File | null;
  const safetyProjectId = formData.get("safetyProjectId")?.toString();
  const itemId = formData.get("itemId")?.toString();

  if (!file || !safetyProjectId || !itemId) return { error: "Missing upload data." };
  if (!file.type.startsWith("image/")) return { error: "File must be an image." };
  if (file.size > 10 * 1024 * 1024) return { error: "Image must be under 10 MB." };

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id: safetyProjectId },
    select: { id: true },
  });
  if (!safetyProject) {
    return { error: "Project not found." };
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `site-prep/photos/${safetyProjectId}/${itemId}-${Date.now()}.${ext}`;
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

  const { completionDate, items, managerSignOffName } = payload;

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!completionDate) return { error: "Completion date is required." };
  if (!managerSignOffName.trim()) return { error: "Site manager name is required for sign-off." };

  const unanswered = items.filter((i) => !i.answer);
  if (unanswered.length > 0) {
    return { error: `${unanswered.length} item${unanswered.length !== 1 ? "s" : ""} have not been answered.` };
  }

  const noWithoutNote = items.filter((i) => i.answer === "NO" && !i.note?.trim());
  if (noWithoutNote.length > 0) {
    return {
      error: `A note is required for all NO items: ${noWithoutNote.map((i) => `"${i.label.substring(0, 40)}…"`).join(", ")}.`,
    };
  }

  const noWithoutPhoto = items.filter((i) => i.answer === "NO" && !i.photoUrl);
  if (noWithoutPhoto.length > 0) {
    return {
      error: `A photo is required for all NO items: ${noWithoutPhoto.map((i) => `"${i.label.substring(0, 40)}…"`).join(", ")}.`,
    };
  }

  // ── Load project & verify pre-start is signed ──────────────────────────────
  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id: safetyProjectId },
    include: {
      preStartAssessments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });
  if (!safetyProject) {
    return { error: "Project not found." };
  }
  if (safetyProject.preStartAssessments.length === 0) {
    return { error: "The Pre-Start Risk Assessment must be completed before the Site Preparation Checklist can be submitted." };
  }

  const managerSignOffAt = new Date();

  // ── Generate PDF ───────────────────────────────────────────────────────────
  let pdfUrl: string | null = null;
  try {
    const pdfBuffer = await generateSitePrepPdf({
      projectName: safetyProject.name,
      projectAddress: safetyProject.address,
      completionDate,
      items,
      managerSignOffName: managerSignOffName.trim(),
      managerSignOffAt,
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
      completedById: user.id,
      completionDate: new Date(completionDate),
      items: items as object[],
      managerSignOffName: managerSignOffName.trim(),
      managerSignOffAt,
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
    await sendSitePrepChecklistEmail({
      to: recipients,
      projectName: safetyProject.name,
      completionDate: new Date(completionDate).toLocaleDateString("en-AU"),
      managerName: managerSignOffName.trim(),
      yesCount: items.filter((i) => i.answer === "YES").length,
      noCount: items.filter((i) => i.answer === "NO").length,
      naCount: items.filter((i) => i.answer === "NA").length,
      pdfUrl,
    });
  } catch (e) {
    console.error("[sitePrep] Email error:", e);
  }

  redirect(`/projects/${safetyProjectId}/site-prep?done=1`);
}
