"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_MANAGER_ROLES } from "@/lib/auth";
import { createStorageAdminClient } from "@/lib/supabase/server";
import { generateAnnualReviewPdf } from "@/lib/pdf/annual-review-pdf";

export type ReviewState = { error?: string };

export interface ReviewPayload {
  checklist: { item: string; clause?: string; confirmed: boolean; notes?: string }[];
  outcome: "CURRENT" | "UPDATED";
  notes: string;
  signatureDataUrl: string;
}

export async function signOffReview(
  templateId: string,
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const user = await requireRole(ADMIN_MANAGER_ROLES);

  const raw = formData.get("payload") as string | null;
  if (!raw) return { error: "Missing form data." };
  let payload: ReviewPayload;
  try {
    payload = JSON.parse(raw) as ReviewPayload;
  } catch {
    return { error: "Invalid form data." };
  }

  if (!payload.checklist.every((c) => c.confirmed)) {
    return { error: "All checklist items must be confirmed before sign-off." };
  }
  if (!payload.signatureDataUrl?.startsWith("data:")) {
    return { error: "A signature is required to sign off the review." };
  }

  const template = await prisma.wHSDocumentTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.organisationId !== user.organisationId) {
    return { error: "Template not found." };
  }

  const newVersion = template.currentVersion + 1;
  const reviewedAt = new Date();
  const storage = createStorageAdminClient();

  // Upload signature
  let signatureUrl: string | null = null;
  try {
    const buf = Buffer.from(payload.signatureDataUrl.replace(/^data:image\/\w+;base64,/, ""), "base64");
    const path = `annual-review/signatures/${templateId}-${Date.now()}.png`;
    const { error } = await storage.from("documents").upload(path, buf, { contentType: "image/png" });
    if (!error) signatureUrl = storage.from("documents").getPublicUrl(path).data.publicUrl;
  } catch {}

  // Generate PDF
  let pdfUrl: string | null = null;
  try {
    const pdf = await generateAnnualReviewPdf({
      templateName: template.name,
      templateKey: template.templateKey,
      version: newVersion,
      reviewedAt,
      reviewerName: user.name ?? user.email,
      isoClauses: template.isoClauses,
      complianceCodes: template.complianceCodes,
      outcome: payload.outcome,
      checklist: payload.checklist,
      notes: payload.notes,
    });
    const path = `annual-review/reports/${templateId}-v${newVersion}-${Date.now()}.pdf`;
    const { error } = await storage.from("documents").upload(path, pdf, { contentType: "application/pdf" });
    if (!error) pdfUrl = storage.from("documents").getPublicUrl(path).data.publicUrl;
  } catch {}

  // New version snapshot + bump template
  const nextReviewDate = new Date(reviewedAt);
  nextReviewDate.setMonth(nextReviewDate.getMonth() + template.reviewIntervalMonths);

  await prisma.$transaction([
    prisma.annualReview.create({
      data: {
        organisationId: user.organisationId,
        templateId,
        templateKey: template.templateKey,
        version: newVersion,
        reviewedById: user.id,
        reviewerName: user.name ?? user.email,
        reviewedAt,
        checklist: payload.checklist,
        outcome: payload.outcome,
        notes: payload.notes?.trim() || null,
        signatureUrl,
        pdfUrl,
      },
    }),
    prisma.wHSDocumentTemplate.update({
      where: { id: templateId },
      data: {
        currentVersion: newVersion,
        lastReviewedAt: reviewedAt,
        lastReviewedBy: user.name ?? user.email,
        nextReviewDate,
        flaggedForReview: false,
        flaggedReason: null,
      },
    }),
  ]);

  revalidatePath("/admin/annual-review");
  redirect("/admin/annual-review");
}
