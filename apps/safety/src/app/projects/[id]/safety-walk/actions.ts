"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { createStorageAdminClient } from "@/lib/supabase/server";
import { generateSafetyWalkPdf } from "@/lib/pdf/safety-walk-pdf";

export type SafetyWalkState = { error?: string };

export interface WalkItemResult {
  id: string;
  question: string;
  answer: "YES" | "NO" | "NA";
  photoUrl?: string;
  notes?: string;
}

export interface SafetyWalkPayload {
  conductedAt: string;
  items: WalkItemResult[];
  observations: string;
  signOffUserId: string;
}

export async function createSafetyWalk(
  projectId: string,
  _prev: SafetyWalkState,
  formData: FormData,
): Promise<SafetyWalkState> {
  const user = await requireRole(AGERO_ROLES);

  const raw = formData.get("payload") as string | null;
  if (!raw) return { error: "Missing form data." };
  let payload: SafetyWalkPayload;
  try {
    payload = JSON.parse(raw) as SafetyWalkPayload;
  } catch {
    return { error: "Invalid form data." };
  }

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, organisationId: true },
  });
  if (!safetyProject || safetyProject.organisationId !== user.organisationId) {
    return { error: "Project not found." };
  }

  const storage = createStorageAdminClient();

  // Upload any photo files from formData
  const itemsWithPhotos: WalkItemResult[] = await Promise.all(
    payload.items.map(async (item) => {
      const photoFile = formData.get(`photo_${item.id}`) as File | null;
      if (photoFile && photoFile.size > 0) {
        const bytes = await photoFile.arrayBuffer();
        const ext = photoFile.name.split(".").pop() ?? "jpg";
        const path = `safety-walk-photos/${projectId}/${Date.now()}-${item.id}.${ext}`;
        const { error } = await storage.from("documents").upload(path, bytes, { contentType: photoFile.type });
        if (!error) {
          const { data } = storage.from("documents").getPublicUrl(path);
          return { ...item, photoUrl: data.publicUrl };
        }
      }
      return item;
    }),
  );

  const conductedAt = new Date(payload.conductedAt);

  let reportUrl: string | null = null;
  try {
    const pdfBuffer = await generateSafetyWalkPdf({
      projectName: safetyProject.name,
      conductedAt,
      conductedBy: user.name ?? user.email,
      items: itemsWithPhotos,
      observations: payload.observations,
    });
    const pdfPath = `safety-walk-reports/${projectId}/${Date.now()}.pdf`;
    const { error } = await storage
      .from("documents")
      .upload(pdfPath, pdfBuffer, { contentType: "application/pdf" });
    if (!error) {
      const { data } = storage.from("documents").getPublicUrl(pdfPath);
      reportUrl = data.publicUrl;
    }
  } catch {}

  await prisma.siteSafetyWalk.create({
    data: {
      projectId,
      conductedById: user.id,
      conductedAt,
      items: itemsWithPhotos as object[],
      observations: payload.observations || undefined,
      reportUrl,
    },
  });

  revalidatePath(`/projects/${projectId}/safety-walk`);
  redirect(`/projects/${projectId}/safety-walk`);
}
