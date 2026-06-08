"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createStorageAdminClient } from "@/lib/supabase/server";

export type SwmsSignState = { error?: string };

export async function acknowledgeSwms(
  projectToken: string,
  workerId: string,
  safetyProjectId: string,
  docIds: string[],
  _prev: SwmsSignState,
  formData: FormData,
): Promise<SwmsSignState> {
  const acknowledged = formData.get("acknowledged") === "1";
  if (!acknowledged) return { error: "Please confirm that you have read and understood the SWMS document(s)." };

  const signatureDataUrl = formData.get("signatureDataUrl")?.toString();

  // Verify the worker and docs still exist
  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: { id: true },
  });
  if (!worker) return { error: "Worker not found." };

  // Upload signature if provided
  let signatureUrl: string | null = null;
  if (signatureDataUrl && !signatureDataUrl.includes("data:,")) {
    try {
      const base64 = signatureDataUrl.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64, "base64");
      const storage = createStorageAdminClient();
      const path = `swms/signatures/${safetyProjectId}/${workerId}-${Date.now()}.png`;
      const { error: uploadError } = await storage
        .from("documents")
        .upload(path, buffer, { contentType: "image/png", upsert: false });
      if (!uploadError) {
        const { data } = storage.from("documents").getPublicUrl(path);
        signatureUrl = data.publicUrl;
      }
    } catch {
      // Non-fatal — proceed without signature image
    }
  }

  const signedAt = new Date();

  // Create WorkerSwmsSignature records for any not yet signed
  const existingSigs = await prisma.workerSwmsSignature.findMany({
    where: {
      workerId,
      projectId: safetyProjectId,
      swmsDocumentId: { in: docIds },
    },
    select: { swmsDocumentId: true },
  });
  const alreadySigned = new Set(existingSigs.map((s) => s.swmsDocumentId));

  const toCreate = docIds.filter((id) => !alreadySigned.has(id));
  if (toCreate.length > 0) {
    await prisma.workerSwmsSignature.createMany({
      data: toCreate.map((swmsDocumentId) => ({
        workerId,
        swmsDocumentId,
        projectId: safetyProjectId,
        signedAt,
        signatureUrl,
      })),
    });
  }

  redirect(`/site/${projectToken}?worker=${workerId}`);
}
