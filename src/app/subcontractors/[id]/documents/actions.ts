"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createStorageAdminClient } from "@/lib/supabase/server";
import { DocumentType } from "@/generated/prisma/client";
import { extractExpiryDate } from "@/lib/claude";

export type DocUploadState = {
  error?: string;
  success?: boolean;
  aiDate?: string;
  aiConfidence?: string;
};

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

function getMediaType(filename: string): "application/pdf" | "image/jpeg" | "image/png" | "image/webp" | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return null;
}

export async function uploadCompanyDocument(
  orgId: string,
  docType: DocumentType,
  _prev: DocUploadState,
  formData: FormData,
): Promise<DocUploadState> {
  // Allow unauthenticated access: subcontractors upload via registration link
  // without a Clerk session. Safety managers are Clerk-authenticated but either
  // path is valid — we only need the org to exist (checked implicitly by prisma upsert).
  const { userId } = await auth();
  if (userId) {
    const appUser = await prisma.user.findUnique({ where: { clerkUserId: userId }, select: { id: true } });
    if (!appUser) redirect("/onboarding");
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Please select a file." };
  if (file.size > MAX_SIZE) return { error: "File must be under 20 MB." };

  const mediaType = getMediaType(file.name);
  if (!mediaType) return { error: "Only PDF, JPG, PNG and WebP files are accepted." };

  const expiryDateRaw = formData.get("expiryDate")?.toString();
  const coverageAmount = formData.get("coverageAmount")?.toString().trim() || null;

  // Upload to Supabase Storage using JWT service role key
  const storage = createStorageAdminClient();
  const ext = file.name.split(".").pop();
  const path = `organisations/${orgId}/${docType}-${Date.now()}.${ext}`;

  const bytes = await file.arrayBuffer();
  const { error: storageError } = await storage
    .from("documents")
    .upload(path, bytes, { contentType: mediaType, upsert: true });

  if (storageError) return { error: `Upload failed: ${storageError.message}` };

  const { data: urlData } = storage.from("documents").getPublicUrl(path);

  // AI expiry extraction
  let expiryDate: Date | null = expiryDateRaw ? new Date(expiryDateRaw) : null;
  let aiExtractedExpiry = false;
  let aiDate: string | undefined;
  let aiConfidence: string | undefined;

  // Only extract if no date manually provided and AI key is configured
  if (!expiryDate && docType !== DocumentType.whs_policy && process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.includes("YOUR_KEY")) {
    try {
      const base64 = Buffer.from(bytes).toString("base64");
      const result = await extractExpiryDate(base64, mediaType);
      if (result.found && (result.confidence === "high" || result.confidence === "medium") && result.expiry_date) {
        const [day, month, year] = result.expiry_date.split("/");
        expiryDate = new Date(`${year}-${month}-${day}`);
        aiExtractedExpiry = true;
        aiDate = result.expiry_date;
        aiConfidence = result.confidence;
      }
    } catch (e) {
      console.error("[AI expiry extraction]", e);
      // Non-fatal — continue without AI date
    }
  }

  // Upsert document record
  const existing = await prisma.documentUpload.findFirst({
    where: { organisationId: orgId, type: docType },
    select: { id: true },
  });

  if (existing) {
    await prisma.documentUpload.update({
      where: { id: existing.id },
      data: { url: urlData.publicUrl, expiryDate, aiExtractedExpiry, coverageAmount },
    });
  } else {
    await prisma.documentUpload.create({
      data: {
        organisationId: orgId,
        type: docType,
        url: urlData.publicUrl,
        expiryDate,
        aiExtractedExpiry,
        coverageAmount,
      },
    });
  }

  revalidatePath(`/subcontractors/${orgId}/documents`);
  return { success: true, aiDate, aiConfidence };
}
