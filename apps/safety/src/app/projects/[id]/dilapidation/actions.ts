"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { createStorageAdminClient } from "@/lib/supabase/server";
import { generateDilapidationPdf } from "@/lib/pdf/dilapidation-pdf";
import { sendDilapidationEmail } from "@/lib/email";

export type DilapidationState = { error?: string };

export interface DilapidationPin {
  pinNumber: number;
  x: number;
  y: number;
  description: string;
  condition: string;
  photoUrls: string[];
}

export interface DilapidationPayload {
  conductedAt: string;
  pins: DilapidationPin[];
  notes: string;
  emailRecipients: string[];
}

export async function createDilapidationReport(
  projectId: string,
  _prev: DilapidationState,
  formData: FormData,
): Promise<DilapidationState> {
  const user = await requireRole(AGERO_ROLES);

  const raw = formData.get("payload") as string | null;
  if (!raw) return { error: "Missing form data." };
  let payload: DilapidationPayload;
  try {
    payload = JSON.parse(raw) as DilapidationPayload;
  } catch {
    return { error: "Invalid form data." };
  }

  if (!payload.pins.length) return { error: "At least one pin is required." };

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, organisationId: true },
  });
  if (!safetyProject || safetyProject.organisationId !== user.organisationId) {
    return { error: "Project not found." };
  }

  const storage = createStorageAdminClient();

  // Upload any photo files
  const pinsWithPhotos: DilapidationPin[] = await Promise.all(
    payload.pins.map(async (pin) => {
      const photoUrls: string[] = [...pin.photoUrls];
      const photoFiles = formData.getAll(`photo_pin_${pin.pinNumber}`) as File[];
      for (const file of photoFiles) {
        if (file.size > 0) {
          const bytes = await file.arrayBuffer();
          const ext = file.name.split(".").pop() ?? "jpg";
          const path = `dilapidation-photos/${projectId}/${Date.now()}-pin${pin.pinNumber}.${ext}`;
          const { error } = await storage.from("documents").upload(path, bytes, { contentType: file.type });
          if (!error) {
            const { data } = storage.from("documents").getPublicUrl(path);
            photoUrls.push(data.publicUrl);
          }
        }
      }
      return { ...pin, photoUrls };
    }),
  );

  const conductedAt = new Date(payload.conductedAt);

  let reportUrl: string | null = null;
  try {
    const pdfBuffer = await generateDilapidationPdf({
      projectName: safetyProject.name,
      conductedAt,
      conductedBy: user.name ?? user.email,
      pins: pinsWithPhotos,
      notes: payload.notes,
    });
    const pdfPath = `dilapidation-reports/${projectId}/${Date.now()}.pdf`;
    const { error } = await storage
      .from("documents")
      .upload(pdfPath, pdfBuffer, { contentType: "application/pdf" });
    if (!error) {
      const { data } = storage.from("documents").getPublicUrl(pdfPath);
      reportUrl = data.publicUrl;
    }
  } catch {}

  await prisma.dilapidationReport.create({
    data: {
      projectId,
      conductedById: user.id,
      conductedAt,
      pins: pinsWithPhotos as object[],
      notes: payload.notes || undefined,
      submittedAt: new Date(),
      reportUrl,
    },
  });

  // Email report
  if (reportUrl && payload.emailRecipients.length > 0) {
    sendDilapidationEmail({
      to: payload.emailRecipients,
      projectName: safetyProject.name,
      conductedAt,
      conductedBy: user.name ?? user.email,
      pinCount: pinsWithPhotos.length,
      pdfUrl: reportUrl,
    }).catch(() => {});
  }

  revalidatePath(`/projects/${projectId}/dilapidation`);
  redirect(`/projects/${projectId}/dilapidation`);
}
