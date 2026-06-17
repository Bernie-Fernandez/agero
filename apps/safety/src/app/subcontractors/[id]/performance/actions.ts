"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_MANAGER_ROLES } from "@/lib/auth";

export type PerformanceState = { error?: string; ok?: boolean };

export async function addPerformanceRecord(
  orgId: string,
  _prev: PerformanceState,
  formData: FormData,
): Promise<PerformanceState> {
  const user = await requireRole([...ADMIN_MANAGER_ROLES, "site_manager"]);

  const org = await prisma.organisation.findFirst({
    where: { id: orgId },
    select: { id: true },
  });
  if (!org) return { error: "Subcontractor not found." };

  const description = (formData.get("description") as string)?.trim();
  if (!description) return { error: "Description is required." };

  const recordType = (formData.get("recordType") as string) || "OBSERVATION";
  const occurredRaw = formData.get("occurredAt") as string | null;
  const projectId = (formData.get("projectId") as string) || null;

  await prisma.subcontractorPerformanceRecord.create({
    data: {
      organisationId: orgId,
      projectId: projectId || null,
      recordType,
      description,
      recordedById: user.id,
      recordedByName: user.name ?? user.email,
      occurredAt: occurredRaw ? new Date(occurredRaw) : new Date(),
    },
  });

  revalidatePath(`/subcontractors/${orgId}/performance`);
  return { ok: true };
}
