"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { createStorageAdminClient } from "@/lib/supabase/server";
import type { DefectStatus } from "@/generated/prisma/client";

export type DefectsState = { error?: string };

export interface DefectItemInput {
  pinNumber: number;
  x: number;
  y: number;
  description: string;
  tradeResponsible: string;
  dueDate: string;
  status: DefectStatus;
  photoUrls: string[];
  notes: string;
}

export interface DefectsPayload {
  conductedAt: string;
  defects: DefectItemInput[];
  notes: string;
}

export async function createDefectsInspection(
  projectId: string,
  _prev: DefectsState,
  formData: FormData,
): Promise<DefectsState> {
  const user = await requireRole(AGERO_ROLES);

  const raw = formData.get("payload") as string | null;
  if (!raw) return { error: "Missing form data." };
  let payload: DefectsPayload;
  try {
    payload = JSON.parse(raw) as DefectsPayload;
  } catch {
    return { error: "Invalid form data." };
  }

  if (!payload.defects.length) return { error: "At least one defect is required." };

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id: projectId },
    select: { id: true, organisationId: true },
  });
  if (!safetyProject || safetyProject.organisationId !== user.organisationId) {
    return { error: "Project not found." };
  }

  const storage = createStorageAdminClient();

  const inspection = await prisma.defectsInspection.create({
    data: {
      projectId,
      conductedById: user.id,
      conductedAt: new Date(payload.conductedAt),
      notes: payload.notes || undefined,
    },
  });

  // Create defect items, uploading photos
  await Promise.all(
    payload.defects.map(async (d) => {
      const photoUrls: string[] = [...d.photoUrls];
      const photoFiles = formData.getAll(`photo_defect_${d.pinNumber}`) as File[];
      for (const file of photoFiles) {
        if (file.size > 0) {
          const bytes = await file.arrayBuffer();
          const ext = file.name.split(".").pop() ?? "jpg";
          const path = `defect-photos/${projectId}/${Date.now()}-defect${d.pinNumber}.${ext}`;
          const { error } = await storage.from("documents").upload(path, bytes, { contentType: file.type });
          if (!error) {
            const { data } = storage.from("documents").getPublicUrl(path);
            photoUrls.push(data.publicUrl);
          }
        }
      }

      await prisma.defectItem.create({
        data: {
          inspectionId: inspection.id,
          pinNumber: d.pinNumber,
          pinX: d.x,
          pinY: d.y,
          description: d.description,
          tradeResponsible: d.tradeResponsible || undefined,
          dueDate: d.dueDate ? new Date(d.dueDate) : undefined,
          status: d.status,
          photoUrls,
          notes: d.notes || undefined,
        },
      });
    }),
  );

  revalidatePath(`/projects/${projectId}/defects`);
  redirect(`/projects/${projectId}/defects`);
}

export async function updateDefectStatus(
  defectId: string,
  projectId: string,
  status: DefectStatus,
): Promise<void> {
  await requireRole(AGERO_ROLES);
  await prisma.defectItem.update({
    where: { id: defectId },
    data: {
      status,
      resolvedAt: status === "COMPLETE" ? new Date() : null,
    },
  });
  revalidatePath(`/projects/${projectId}/defects`);
}
