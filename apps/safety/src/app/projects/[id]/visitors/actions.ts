"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { createStorageAdminClient } from "@/lib/supabase/server";

export type VisitorSignInState = { error?: string; success?: boolean };

export async function signInVisitor(
  safetyProjectId: string,
  _prev: VisitorSignInState,
  formData: FormData,
): Promise<VisitorSignInState> {
  const visitorName = (formData.get("visitorName") as string | null)?.trim() ?? "";
  const company = (formData.get("company") as string | null)?.trim() || undefined;
  const purpose = (formData.get("purpose") as string | null)?.trim() || undefined;
  const hostName = (formData.get("hostName") as string | null)?.trim() || undefined;
  const signatureDataUrl = formData.get("signatureDataUrl") as string | null;

  if (!visitorName) return { error: "Visitor name is required." };
  if (!signatureDataUrl || !signatureDataUrl.startsWith("data:")) {
    return { error: "Please provide your signature." };
  }

  const project = await prisma.safetyProject.findUnique({
    where: { id: safetyProjectId },
    select: { id: true },
  });
  if (!project) return { error: "Project not found." };

  // Upload signature to Supabase
  const base64Data = signatureDataUrl.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  const storagePath = `visitor-signatures/${safetyProjectId}/${Date.now()}.png`;

  const storage = createStorageAdminClient();
  const { error: storageError } = await storage
    .from("documents")
    .upload(storagePath, buffer, { contentType: "image/png", upsert: false });
  if (storageError) return { error: `Signature upload failed: ${storageError.message}` };

  const { data: urlData } = storage.from("documents").getPublicUrl(storagePath);

  await prisma.visitorSignIn.create({
    data: {
      projectId: safetyProjectId,
      visitorName,
      company,
      purpose,
      hostName,
      signatureUrl: urlData.publicUrl,
      acknowledgedAt: new Date(),
    },
  });

  revalidatePath(`/projects/${safetyProjectId}/visitors`);
  return { success: true };
}

export async function signOutVisitor(
  visitorId: string,
  safetyProjectId: string,
): Promise<void> {
  await requireRole(AGERO_ROLES);
  await prisma.visitorSignIn.update({
    where: { id: visitorId },
    data: { signedOutAt: new Date() },
  });
  revalidatePath(`/projects/${safetyProjectId}/visitors`);
}
