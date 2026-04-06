"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { createStorageAdminClient } from "@/lib/supabase/server";
import { DocumentType } from "@/generated/prisma/client";
import { sendInductionLink } from "@/lib/alerts";

export type WorkerFormState = { error?: string };

export async function addWorker(
  orgId: string,
  _prev: WorkerFormState,
  formData: FormData,
): Promise<WorkerFormState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const firstName = formData.get("firstName")?.toString().trim();
  const lastName = formData.get("lastName")?.toString().trim();
  const mobile = formData.get("mobile")?.toString().trim() || null;
  const email = formData.get("email")?.toString().trim() || null;
  const trade = formData.get("trade")?.toString().trim() || null;
  const projectId = formData.get("projectId")?.toString();

  if (!firstName || !lastName) return { error: "First and last name are required." };
  if (!projectId) return { error: "Project is required." };

  const worker = await prisma.worker.create({
    data: {
      firstName,
      lastName,
      mobile,
      email,
      trade,
      projectId,
      employingOrganisationId: orgId,
    },
  });

  // Send induction link if we have a generic induction template
  const genericTemplate = await prisma.inductionTemplate.findFirst({
    where: { type: "generic", isActive: true },
  });

  if (genericTemplate && (mobile || email)) {
    const host = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    await sendInductionLink({
      workerName: `${firstName} ${lastName}`,
      workerMobile: mobile ?? "",
      workerEmail: email ?? undefined,
      inductionUrl: `${host}/inductions/${genericTemplate.id}?worker=${worker.id}`,
    });
  }

  redirect(`/organisations/${orgId}/workers`);
}

export async function uploadWorkerDocument(
  workerId: string,
  orgId: string,
  docType: DocumentType,
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Please select a file." };

  const expiryRaw = formData.get("expiryDate")?.toString();
  const expiryDate = expiryRaw ? new Date(expiryRaw) : null;

  const storage = createStorageAdminClient();
  const ext = file.name.split(".").pop();
  const path = `workers/${workerId}/${docType}-${Date.now()}.${ext}`;

  const { error: storageError } = await storage
    .from("documents")
    .upload(path, file, { upsert: true });

  if (storageError) return { error: `Upload failed: ${storageError.message}` };

  const { data: urlData } = storage.from("documents").getPublicUrl(path);

  const existing = await prisma.documentUpload.findFirst({
    where: { workerId, type: docType },
    select: { id: true },
  });

  if (existing) {
    await prisma.documentUpload.update({
      where: { id: existing.id },
      data: { url: urlData.publicUrl, expiryDate },
    });
  } else {
    await prisma.documentUpload.create({
      data: { workerId, type: docType, url: urlData.publicUrl, expiryDate },
    });
  }

  return { success: true };
}
