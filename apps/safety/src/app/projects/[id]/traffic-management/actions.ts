"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { createStorageAdminClient } from "@/lib/supabase/server";
import { validateHierarchy, type ControlMeasure } from "@/lib/hierarchy-of-controls";
import { generateRiskAssessmentPdf } from "@/lib/pdf/risk-assessment-pdf";
import { TRAFFIC_REVIEW_ITEMS, AS_REFERENCE } from "./constants";

export type TrafficState = { error?: string };

export interface TrafficPayload {
  conductedAt: string;
  reviewItems: { id: string; answer: "YES" | "NO" | "NA"; notes: string }[];
  hazards: { hazard: string; riskRating: string }[];
  controls: ControlMeasure[];
  ppeJustification: string;
  notes: string;
}

export async function createTrafficReview(
  projectId: string,
  _prev: TrafficState,
  formData: FormData,
): Promise<TrafficState> {
  const user = await requireRole(AGERO_ROLES);

  const raw = formData.get("payload") as string | null;
  if (!raw) return { error: "Missing form data." };
  let payload: TrafficPayload;
  try {
    payload = JSON.parse(raw) as TrafficPayload;
  } catch {
    return { error: "Invalid form data." };
  }

  if (!payload.conductedAt) return { error: "Date is required." };
  const hazards = payload.hazards.filter((h) => h.hazard.trim());
  if (hazards.length === 0) return { error: "At least one traffic hazard is required." };

  const hierarchy = validateHierarchy(payload.controls, payload.ppeJustification);
  if (!hierarchy.ok) return { error: hierarchy.error };

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, organisationId: true },
  });
  if (!safetyProject || safetyProject.organisationId !== user.organisationId) {
    return { error: "Project not found." };
  }

  const conductedAt = new Date(payload.conductedAt);
  const controls = payload.controls.filter((c) => c.description.trim());

  // Summarise the review checklist into the PDF risk-factors block.
  const reviewSummary = payload.reviewItems.map((item) => {
    const def = TRAFFIC_REVIEW_ITEMS.find((q) => q.id === item.id);
    return `${item.answer}: ${def?.question ?? item.id}${item.notes ? ` — ${item.notes}` : ""}`;
  });

  let reportUrl: string | null = null;
  try {
    const pdf = await generateRiskAssessmentPdf({
      title: "Traffic Management Review & Hazard Assessment",
      projectName: safetyProject.name,
      conductedBy: user.name ?? user.email,
      conductedAt,
      taskDescription: "Traffic management for site works adjacent to road / traffic.",
      complianceNote: `Traffic control devices and TMP aligned to ${AS_REFERENCE}.`,
      riskFactors: reviewSummary,
      hazards,
      controls,
      ppeOnly: hierarchy.ppeOnly,
      ppeJustification: payload.ppeJustification,
    });
    const storage = createStorageAdminClient();
    const path = `traffic-management/${projectId}/${Date.now()}.pdf`;
    const { error } = await storage.from("documents").upload(path, pdf, { contentType: "application/pdf" });
    if (!error) reportUrl = storage.from("documents").getPublicUrl(path).data.publicUrl;
  } catch {}

  await prisma.trafficManagementReview.create({
    data: {
      projectId,
      conductedById: user.id,
      reviewItems: payload.reviewItems as unknown as Prisma.InputJsonValue,
      hazards: hazards.map((h) => ({ ...h, controls })) as unknown as Prisma.InputJsonValue,
      notes: payload.notes?.trim() || null,
      conductedAt,
      reportUrl,
    },
  });

  revalidatePath(`/projects/${projectId}/traffic-management`);
  redirect(`/projects/${projectId}/traffic-management`);
}
