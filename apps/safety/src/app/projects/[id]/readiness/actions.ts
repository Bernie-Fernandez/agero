"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function toggleBuildingMgmtRequired(
  safetyProjectId: string,
  required: boolean,
): Promise<void> {
  const user = await requireRole(AGERO_ROLES);
  const project = await prisma.safetyProject.findUnique({
    where: { id: safetyProjectId },
    select: { organisationId: true },
  });
  if (!project || project.organisationId !== user.organisationId) return;
  await prisma.safetyProject.update({
    where: { id: safetyProjectId },
    data: { buildingMgmtInductionRequired: required },
  });
  revalidatePath(`/projects/${safetyProjectId}/readiness`);
}
