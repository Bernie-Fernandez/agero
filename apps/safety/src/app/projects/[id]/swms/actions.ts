"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, AGERO_ROLES, ADMIN_MANAGER_ROLES } from "@/lib/auth";
import { createStorageAdminClient } from "@/lib/supabase/server";

export type SwmsUploadState = { error?: string; success?: boolean };

const MAX_SIZE = 50 * 1024 * 1024;

export async function uploadSwmsDocument(
  safetyProjectId: string,
  orgId: string,
  _prev: SwmsUploadState,
  formData: FormData,
): Promise<SwmsUploadState> {
  await requireRole([...ADMIN_MANAGER_ROLES, "project_manager"]);

  const file = formData.get("file") as File | null;
  const tradeCategory = formData.get("tradeCategory")?.toString().trim();

  if (!file || file.size === 0) return { error: "Please select a PDF file." };
  if (file.size > MAX_SIZE) return { error: "File must be under 50 MB." };
  if (!file.name.toLowerCase().endsWith(".pdf")) return { error: "Only PDF files are accepted." };
  if (!tradeCategory) return { error: "Trade category is required." };

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id: safetyProjectId },
    select: { id: true },
  });
  if (!safetyProject) return { error: "Project not found." };

  const storage = createStorageAdminClient();
  const bytes = await file.arrayBuffer();
  const path = `swms/safety/${safetyProjectId}/${orgId}-${Date.now()}.pdf`;

  const { error: storageError } = await storage
    .from("documents")
    .upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (storageError) return { error: `Upload failed: ${storageError.message}` };

  const { data: urlData } = storage.from("documents").getPublicUrl(path);

  // Determine version number for this project + org + trade
  const lastDoc = await prisma.swmsDocument.findFirst({
    where: { projectId: safetyProjectId, organisationId: orgId, tradeCategory },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (lastDoc?.version ?? 0) + 1;

  // Mark previous docs for same trade as not current
  await prisma.swmsDocument.updateMany({
    where: { projectId: safetyProjectId, organisationId: orgId, tradeCategory, isCurrent: true },
    data: { isCurrent: false },
  });

  await prisma.swmsDocument.create({
    data: {
      projectId: safetyProjectId,
      organisationId: orgId,
      tradeCategory,
      documentUrl: urlData.publicUrl,
      version,
      isCurrent: true,
    },
  });

  redirect(`/projects/${safetyProjectId}/swms`);
}

export async function approveSwmsDocument(
  docId: string,
  safetyProjectId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<void> {
  const user = await requireRole(ADMIN_MANAGER_ROLES);
  const now = new Date();

  const doc = await prisma.swmsDocument.update({
    where: { id: docId },
    data: {
      ageroApproved: true,
      ageroApprovedBy: user.name ?? user.email,
      ageroApprovedAt: now,
    },
    select: { tradeCategory: true, organisationId: true },
  });

  prisma.consultationEvent.create({
    data: {
      projectId: safetyProjectId,
      eventType: "SWMS_APPROVAL",
      referenceId: docId,
      consultedPersons: [{ name: user.name ?? user.email, role: "Safety Manager" }],
      notes: `SWMS approved — ${doc.tradeCategory ?? "General"}`,
      eventDate: now,
    },
  }).catch(() => {});

  redirect(`/projects/${safetyProjectId}/swms`);
}

export async function rejectSwmsDocument(
  docId: string,
  safetyProjectId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<void> {
  const user = await requireRole(ADMIN_MANAGER_ROLES);

  await prisma.swmsDocument.update({
    where: { id: docId },
    data: {
      ageroApproved: false,
      ageroApprovedBy: user.name ?? user.email,
      ageroApprovedAt: new Date(),
    },
  });

  redirect(`/projects/${safetyProjectId}/swms`);
}

export async function requiresSwmsReview(
  safetyProjectId: string,
): Promise<boolean> {
  await requireRole(AGERO_ROLES);
  const pending = await prisma.swmsDocument.count({
    where: { projectId: safetyProjectId, ageroApproved: null },
  });
  return pending > 0;
}
