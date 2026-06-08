"use server";

import { revalidatePath } from "next/cache";
import { getAppUser, AGERO_ROLES } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createStorageAdminClient } from "@/lib/supabase/server";
import { extractCredentialData } from "@/lib/claude";
import type { CredentialExtraction } from "@/lib/claude";

export type UploadExtractResult =
  | { error: string }
  | { photoUrl: string; extraction: CredentialExtraction };

export type SaveCredentialState = { error?: string };

export async function uploadAndExtract(
  workerId: string,
  credentialTypeLabel: string,
  formData: FormData,
): Promise<UploadExtractResult> {
  const appUser = await getAppUser();

  if ((AGERO_ROLES as string[]).includes(appUser.role)) {
    return { error: "Agero staff cannot add or edit credentials. Credentials are managed by the worker's company." };
  }

  // Sub-admin org ownership check
  if (appUser.role === "subcontractor_admin") {
    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: { employingOrganisationId: true },
    });
    if (!worker) return { error: "Worker not found." };
    if (worker.employingOrganisationId !== appUser.organisationId) {
      return { error: "You can only manage credentials for workers in your company." };
    }
  }

  const file = formData.get("photo") as File | null;
  if (!file || file.size === 0) return { error: "No photo selected." };

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"] as const;
  type AllowedMime = (typeof allowedTypes)[number];
  if (!allowedTypes.includes(file.type as AllowedMime)) {
    return { error: "Photo must be JPEG, PNG, or WebP." };
  }
  const mediaType = file.type as AllowedMime;

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = mediaType === "image/png" ? "png" : mediaType === "image/webp" ? "webp" : "jpg";
  const path = `workers/credentials/${workerId}/${Date.now()}.${ext}`;

  const storage = createStorageAdminClient();
  const { error: uploadError } = await storage
    .from("documents")
    .upload(path, buffer, { contentType: mediaType, upsert: false });

  if (uploadError) {
    console.error("[credential-upload]", uploadError);
    return { error: "Photo upload failed. Please try again." };
  }

  const { data: urlData } = storage.from("documents").getPublicUrl(path);
  const photoUrl = urlData.publicUrl;

  const base64 = buffer.toString("base64");
  const extraction = await extractCredentialData(base64, mediaType, credentialTypeLabel);

  return { photoUrl, extraction };
}

export async function saveCredential(
  workerId: string,
  safetyProjectId: string,
  _prev: SaveCredentialState,
  formData: FormData,
): Promise<SaveCredentialState> {
  const appUser = await getAppUser();

  if ((AGERO_ROLES as string[]).includes(appUser.role)) {
    return { error: "Agero staff cannot add or edit credentials. Credentials are managed by the worker's company." };
  }

  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: { employingOrganisationId: true },
  });
  if (!worker) return { error: "Worker not found." };

  // Sub-admin: must own the worker's org
  if (appUser.role === "subcontractor_admin") {
    if (worker.employingOrganisationId !== appUser.organisationId) {
      return { error: "You can only manage credentials for workers in your company." };
    }
  }

  const credentialType = formData.get("credentialType") as string;
  const photoUrl = formData.get("photoUrl") as string | null;
  const credentialNumber = (formData.get("credentialNumber") as string)?.trim() || null;
  const issuingBody = (formData.get("issuingBody") as string)?.trim() || null;
  const issueDateRaw = (formData.get("issueDate") as string)?.trim();
  const expiryDateRaw = (formData.get("expiryDate") as string)?.trim();
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!credentialType) return { error: "Credential type is required." };

  const issueDate = issueDateRaw ? new Date(issueDateRaw) : null;
  const expiryDate = expiryDateRaw ? new Date(expiryDateRaw) : null;

  if (issueDate && isNaN(issueDate.getTime())) return { error: "Invalid issue date." };
  if (expiryDate && isNaN(expiryDate.getTime())) return { error: "Invalid expiry date." };

  await prisma.workerCredential.create({
    data: {
      workerId,
      organisationId: worker.employingOrganisationId ?? null,
      credentialType: credentialType as Parameters<typeof prisma.workerCredential.create>[0]["data"]["credentialType"],
      credentialNumber,
      issuingBody,
      issueDate,
      expiryDate,
      photoUrl: photoUrl || null,
      notes,
      isVerified: false,
    },
  });

  const safetyProject = safetyProjectId
    ? await prisma.safetyProject.findUnique({
        where: { id: safetyProjectId },
        select: { id: true },
      })
    : null;

  if (safetyProject) {
    revalidatePath(`/projects/${safetyProject.id}/readiness/worker/${workerId}`);
  }
  revalidatePath(`/portal/workers/${workerId}`);
  revalidatePath("/portal");
  return {};
}
