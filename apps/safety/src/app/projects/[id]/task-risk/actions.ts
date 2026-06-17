"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { createStorageAdminClient } from "@/lib/supabase/server";
import { validateHierarchy, type ControlMeasure } from "@/lib/hierarchy-of-controls";
import { generateRiskAssessmentPdf } from "@/lib/pdf/risk-assessment-pdf";

export type TaskRiskState = { error?: string };

export interface TaskRiskPayload {
  conductedAt: string;
  taskDescription: string;
  location: string;
  hazards: { hazard: string; riskRating: string }[];
  controls: ControlMeasure[];
  ppeJustification: string;
  residualRisk: string;
}

const COMPLIANCE_NOTE =
  "Task Risk Assessment · VIC OHS Act 2004 s21 · OHS Regulations 2017 · hierarchy of controls applied.";

export async function createTaskRisk(
  projectId: string,
  _prev: TaskRiskState,
  formData: FormData,
): Promise<TaskRiskState> {
  const user = await requireRole(AGERO_ROLES);

  const raw = formData.get("payload") as string | null;
  if (!raw) return { error: "Missing form data." };
  let payload: TaskRiskPayload;
  try {
    payload = JSON.parse(raw) as TaskRiskPayload;
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
  const hazards = payload.hazards.filter((h) => h.hazard.trim());

  let reportUrl: string | null = null;
  try {
    const pdf = await generateRiskAssessmentPdf({
      title: "Task Risk Assessment",
      projectName: safetyProject.name,
      conductedBy: user.name ?? user.email,
      conductedAt,
      taskDescription: payload.taskDescription,
      location: payload.location,
      complianceNote: COMPLIANCE_NOTE,
      hazards,
      controls,
      ppeOnly: hierarchy.ppeOnly,
      ppeJustification: payload.ppeJustification,
      residualRisk: payload.residualRisk,
    });
    const storage = createStorageAdminClient();
    const path = `task-risk/${projectId}/${Date.now()}.pdf`;
    const { error } = await storage.from("documents").upload(path, pdf, { contentType: "application/pdf" });
    if (!error) reportUrl = storage.from("documents").getPublicUrl(path).data.publicUrl;
  } catch {}

  await prisma.taskRiskAssessment.create({
    data: {
      projectId,
      conductedById: user.id,
      taskDescription: payload.taskDescription.trim(),
      location: payload.location?.trim() || null,
      hazards: hazards as unknown as Prisma.InputJsonValue,
      controls: controls as unknown as Prisma.InputJsonValue,
      ppeOnly: hierarchy.ppeOnly,
      ppeJustification: hierarchy.ppeOnly ? payload.ppeJustification.trim() : null,
      residualRisk: payload.residualRisk?.trim() || null,
      conductedAt,
      reportUrl,
    },
  });

  revalidatePath(`/projects/${projectId}/task-risk`);
  redirect(`/projects/${projectId}/task-risk`);
}
