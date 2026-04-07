"use server";

import { prisma } from "@/lib/prisma";
import { getWorkerSession } from "@/lib/worker-auth";
import { createStorageAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export type ProfileState = { error?: string; success?: string };

export async function updateProfile(_prev: ProfileState, fd: FormData): Promise<ProfileState> {
  const session = await getWorkerSession();
  if (!session) redirect("/worker/login");

  const firstName = fd.get("firstName")?.toString().trim() ?? "";
  const lastName = fd.get("lastName")?.toString().trim() ?? "";
  const mobile = fd.get("mobile")?.toString().trim() ?? "";
  const trades = fd.getAll("trades").map((t) => t.toString());
  const whiteCardNumber = fd.get("whiteCardNumber")?.toString().trim() || null;
  const whiteCardExpiry = fd.get("whiteCardExpiry")?.toString() || null;
  const tradeLicenceNumber = fd.get("tradeLicenceNumber")?.toString().trim() || null;
  const tradeLicenceExpiry = fd.get("tradeLicenceExpiry")?.toString() || null;
  const firstAidCertNumber = fd.get("firstAidCertNumber")?.toString().trim() || null;
  const firstAidExpiry = fd.get("firstAidExpiry")?.toString() || null;

  // New fields
  const dateOfBirth = fd.get("dateOfBirth")?.toString() || null;
  const addressStreet = fd.get("addressStreet")?.toString().trim() || null;
  const addressSuburb = fd.get("addressSuburb")?.toString().trim() || null;
  const addressState = fd.get("addressState")?.toString().trim() || null;
  const addressPostcode = fd.get("addressPostcode")?.toString().trim() || null;
  const nokName = fd.get("nokName")?.toString().trim() || null;
  const nokRelationship = fd.get("nokRelationship")?.toString().trim() || null;
  const nokMobile = fd.get("nokMobile")?.toString().trim() || null;
  const medicalConditions = fd.get("medicalConditions")?.toString().trim() || null;

  if (!firstName || !lastName || !mobile) {
    return { error: "Name and mobile are required." };
  }
  if (!whiteCardNumber) {
    return { error: "White card number is required." };
  }

  // If mobile changed, ensure no other account owns that mobile
  if (mobile !== session.workerAccount.mobile) {
    const conflict = await prisma.workerAccount.findUnique({ where: { mobile } });
    if (conflict && conflict.id !== session.workerAccountId) {
      return { error: "That mobile number is already linked to another account." };
    }
  }

  await prisma.workerAccount.update({
    where: { id: session.workerAccountId },
    data: {
      firstName,
      lastName,
      mobile,
      trades,
      whiteCardNumber,
      whiteCardExpiry: whiteCardExpiry ? new Date(whiteCardExpiry) : null,
      tradeLicenceNumber,
      tradeLicenceExpiry: tradeLicenceExpiry ? new Date(tradeLicenceExpiry) : null,
      firstAidCertNumber,
      firstAidExpiry: firstAidExpiry ? new Date(firstAidExpiry) : null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      addressStreet,
      addressSuburb,
      addressState,
      addressPostcode,
      nokName,
      nokRelationship,
      nokMobile,
      medicalConditions,
    },
  });

  revalidatePath("/worker/profile");
  revalidatePath("/worker/dashboard");
  return { success: "Profile updated." };
}

export type CertUploadState = { error?: string; success?: string };

export async function uploadCertDocument(
  _prev: CertUploadState,
  fd: FormData,
): Promise<CertUploadState> {
  const session = await getWorkerSession();
  if (!session) redirect("/worker/login");

  const docType = fd.get("docType")?.toString() ?? "other";
  const file = fd.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please select a file to upload." };
  }

  if (file.size > 10 * 1024 * 1024) {
    return { error: "File must be under 10 MB." };
  }

  try {
    const storage = createStorageAdminClient();
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `workers/${session.workerAccountId}/certs/${docType}-${Date.now()}.${ext}`;
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await storage
      .from("documents")
      .upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: false });

    if (uploadError) {
      console.error("[cert upload]", uploadError);
      return { error: "Upload failed. Please try again." };
    }

    const { data } = storage.from("documents").getPublicUrl(path);

    // Try AI expiry extraction using Claude
    let extractedExpiry: Date | null = null;
    let aiExtracted = false;
    if (process.env.ANTHROPIC_API_KEY && file.type.startsWith("image/")) {
      try {
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const client = new Anthropic();
        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const mediaType = file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

        const msg = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 256,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: { type: "base64", media_type: mediaType, data: base64 },
                },
                {
                  type: "text",
                  text: 'Extract the expiry date from this licence or certificate. Reply with ONLY the date in YYYY-MM-DD format, or "none" if no expiry date is visible.',
                },
              ],
            },
          ],
        });

        const raw = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          extractedExpiry = new Date(raw);
          aiExtracted = true;
        }
      } catch {
        // Non-fatal
      }
    }

    await prisma.workerCertDocument.create({
      data: {
        workerAccountId: session.workerAccountId,
        docType,
        url: data.publicUrl,
        filename: file.name,
        expiryDate: extractedExpiry,
        aiExtractedExpiry: aiExtracted,
      },
    });

    // Auto-update the expiry field on the WorkerAccount if extracted
    if (extractedExpiry && aiExtracted) {
      const fieldMap: Record<string, string> = {
        white_card: "whiteCardExpiry",
        trade_licence: "tradeLicenceExpiry",
        first_aid: "firstAidExpiry",
      };
      const field = fieldMap[docType];
      if (field) {
        await prisma.workerAccount.update({
          where: { id: session.workerAccountId },
          data: { [field]: extractedExpiry },
        });
      }
    }

    revalidatePath("/worker/profile");
    return {
      success: aiExtracted
        ? `Uploaded. Expiry date ${extractedExpiry!.toLocaleDateString("en-AU")} auto-extracted by AI.`
        : "Uploaded successfully.",
    };
  } catch (e) {
    console.error("[cert upload]", e);
    return { error: "Upload failed. Please try again." };
  }
}
