"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { createStorageAdminClient } from "@/lib/supabase/server";

export type FloorPlanState = { error?: string; success?: boolean };

const MAX_SIZE = 20 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export async function uploadFloorPlan(
  safetyProjectId: string,
  _prev: FloorPlanState,
  formData: FormData,
): Promise<FloorPlanState> {
  const user = await requireRole(AGERO_ROLES);

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Please select a file." };
  if (file.size > MAX_SIZE) return { error: "File must be under 20 MB." };
  if (!ACCEPTED_TYPES.includes(file.type)) return { error: "Accepted formats: JPEG, PNG, WebP, or PDF." };

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id: safetyProjectId },
    select: { id: true, organisationId: true },
  });
  if (!safetyProject || safetyProject.organisationId !== user.organisationId) {
    return { error: "Project not found." };
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const storagePath = `floor-plans/${safetyProjectId}-${Date.now()}.${ext}`;
  const bytes = await file.arrayBuffer();

  const storage = createStorageAdminClient();
  const { error: storageError } = await storage
    .from("documents")
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (storageError) return { error: `Upload failed: ${storageError.message}` };

  const { data: urlData } = storage.from("documents").getPublicUrl(storagePath);

  await prisma.projectFloorPlan.upsert({
    where: { safetyProjectId },
    update: {
      fileUrl: urlData.publicUrl,
      fileName: file.name,
      uploadedBy: user.name ?? user.email,
      uploadedAt: new Date(),
    },
    create: {
      safetyProjectId,
      fileUrl: urlData.publicUrl,
      fileName: file.name,
      uploadedBy: user.name ?? user.email,
    },
  });

  revalidatePath(`/projects/${safetyProjectId}/site-prep`);
  return { success: true };
}
