"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { createStorageAdminClient } from "@/lib/supabase/server";
import { validateHierarchy, type ControlMeasure } from "@/lib/hierarchy-of-controls";
import { generateRiskAssessmentPdf } from "@/lib/pdf/risk-assessment-pdf";

export type ManualHandlingState = { error?: string };

export interface ManualHandlingPayload {
  conductedAt: string;
  taskDescription: string;
  location: string;
  riskFactors: string[];
  controls: ControlMeasure[];
  ppeJustification: string;
  residualRisk: string;
}

const COMPLIANCE_NOTE =
  "Manual Handling Risk Assessment · VIC OHS Regulations 2017 Part 3.1 · Hazardous Manual Handling Compliance Code (WorkSafe Victoria).";

export async function createManualHandling(
  projectId: string,
  _prev: ManualHandlingState,
  formData: FormData,
): Promise<ManualHandlingState> {
  const user = await requireRole(AGERO_ROLES);

  const raw = formData.get("payload") as string | null;
  if (!raw) return { error: "Missing form data." };
  let payload: ManualHandlingPayload;
  try {
    payload = JSON.parse(raw) as ManualHandlingPayload;
  } catch {
    return { error: "Invalid form data." };
  }

  if (!payload.taskDescription?.trim()) return { error: "Task description is required." };
  if (!payload.conductedAt) return { error: "Assessment date is required." };

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

  let reportUrl: string | null = null;
  try {
    const pdf = await generateRiskAssessmentPdf({
      title: "Manual Handling Risk Assessment",
      projectName: safetyProject.name,
      conductedBy: user.name ?? user.email,
      conductedAt,
      taskDescription: payload.taskDescription,
      location: payload.location,
      complianceNote: COMPLIANCE_NOTE,
      riskFactors: payload.riskFactors,
      controls,
      ppeOnly: hierarchy.ppeOnly,
      ppeJustification: payload.ppeJustification,
      residualRisk: payload.residualRisk,
    });
    const storage = createStorageAdminClient();
    const path = `manual-handling/${projectId}/${Date.now()}.pdf`;
    const { error } = await storage.from("documents").upload(path, pdf, { contentType: "application/pdf" });
    if (!error) reportUrl = storage.from("documents").getPublicUrl(path).data.publicUrl;
  } catch {}

  await prisma.manualHandlingAssessment.create({
    data: {
      projectId,
      conductedById: user.id,
      taskDescription: payload.taskDescription.trim(),
      location: payload.location?.trim() || null,
      riskFactors: payload.riskFactors,
      controls: controls as unknown as Prisma.InputJsonValue,
      ppeOnly: hierarchy.ppeOnly,
      ppeJustification: hierarchy.ppeOnly ? payload.ppeJustification.trim() : null,
      residualRisk: payload.residualRisk?.trim() || null,
      conductedAt,
      reportUrl,
    },
  });

  revalidatePath(`/projects/${projectId}/manual-handling`);
  redirect(`/projects/${projectId}/manual-handling`);
}
