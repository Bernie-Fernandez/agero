"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/safety/prisma";
import { redirect } from "next/navigation";
import { createStorageAdminClient } from "@/lib/safety/supabase-server";
import { DocumentType } from "@/generated/safety-prisma/client";

export type DocUploadState = { error?: string; success?: boolean };

export async function uploadProjectDocument(
  projectId: string,
  docType: DocumentType,
  _prev: DocUploadState,
  formData: FormData,
): Promise<DocUploadState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const appUser = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (!appUser) redirect("/onboarding");

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.organisationId !== appUser.organisationId) {
    return { error: "Project not found." };
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Please select a file." };

  const expiryRaw = formData.get("expiryDate")?.toString();
  const expiryDate = expiryRaw ? new Date(expiryRaw) : null;

  const storage = createStorageAdminClient();
  const ext = file.name.split(".").pop();
  const path = `projects/${projectId}/${docType}-${Date.now()}.${ext}`;

  const { error: storageError } = await storage
    .from("documents")
    .upload(path, file, { upsert: true });

  if (storageError) return { error: `Upload failed: ${storageError.message}` };

  const { data: urlData } = storage.from("documents").getPublicUrl(path);

  await prisma.documentUpload.upsert({
    where: {
      // No natural unique key — use findFirst + create instead
      id: (
        await prisma.documentUpload.findFirst({
          where: { projectId, type: docType },
          select: { id: true },
        })
      )?.id ?? "00000000-0000-0000-0000-000000000000",
    },
    update: { url: urlData.publicUrl, expiryDate },
    create: { projectId, type: docType, url: urlData.publicUrl, expiryDate },
  });

  return { success: true };
}

export async function addSubcontractorToProject(
  projectId: string,
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const appUser = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (!appUser) redirect("/onboarding");

  const orgId = formData.get("organisationId")?.toString();
  if (!orgId) return { error: "Please select a subcontractor." };

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.organisationId !== appUser.organisationId) {
    return { error: "Project not found." };
  }

  await prisma.projectSubcontractor.upsert({
    where: { projectId_subcontractorOrgId: { projectId, subcontractorOrgId: orgId } },
    update: {},
    create: { projectId, subcontractorOrgId: orgId },
  });

  return {};
}
