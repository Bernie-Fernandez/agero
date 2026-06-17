"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getWorkerSession } from "@/lib/worker-auth";

export type DeletionRequestState = { error?: string; ok?: boolean };

// Worker-initiated data deletion request (APP 11 / Privacy Act). Queued for
// Director approval — not actioned immediately (OHS records must be retained
// until the Director confirms anonymisation).
export async function requestDataDeletion(
  _prev: DeletionRequestState,
  formData: FormData,
): Promise<DeletionRequestState> {
  const session = await getWorkerSession();
  if (!session) return { error: "Your session has expired. Please log in again." };

  const workerAccountId = session.workerAccountId;
  const existing = await prisma.dataDeletionRequest.findFirst({
    where: { workerAccountId, status: "PENDING" },
    select: { id: true },
  });
  if (existing) return { error: "You already have a deletion request pending review." };

  await prisma.dataDeletionRequest.create({
    data: {
      workerAccountId,
      reason: (formData.get("reason") as string)?.trim() || null,
      status: "PENDING",
    },
  });

  revalidatePath("/worker/profile");
  return { ok: true };
}
