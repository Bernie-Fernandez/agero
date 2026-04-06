"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { createStorageAdminClient } from "@/lib/supabase/server";
import { DocumentType } from "@/generated/prisma/client";

export type DocState = { error?: string; success?: boolean };

export async function uploadOrgDocument(
  orgId: string,
  docType: DocumentType,
  _prev: DocState,
  formData: FormData,
): Promise<DocState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Please select a file." };

  const expiryRaw = formData.get("expiryDate")?.toString();
  const expiryDate = expiryRaw ? new Date(expiryRaw) : null;

  const storage = createStorageAdminClient();
  const ext = file.name.split(".").pop();
  const path = `organisations/${orgId}/${docType}-${Date.now()}.${ext}`;

  const { error: storageError } = await storage
    .from("documents")
    .upload(path, file, { upsert: true });

  if (storageError) return { error: `Upload failed: ${storageError.message}` };

  const { data: urlData } = storage.from("documents").getPublicUrl(path);

  const existing = await prisma.documentUpload.findFirst({
    where: { organisationId: orgId, type: docType },
    select: { id: true },
  });

  if (existing) {
    await prisma.documentUpload.update({
      where: { id: existing.id },
      data: { url: urlData.publicUrl, expiryDate },
    });
  } else {
    await prisma.documentUpload.create({
      data: { organisationId: orgId, type: docType, url: urlData.publicUrl, expiryDate },
    });
  }

  return { success: true };
}
