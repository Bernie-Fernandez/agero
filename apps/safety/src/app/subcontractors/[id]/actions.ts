"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_MANAGER_ROLES } from "@/lib/auth";
import type { UserRole } from "@/generated/prisma/client";

const ASSIGN_ROLES: UserRole[] = [...ADMIN_MANAGER_ROLES, "site_manager"];

export type AssignState = { error?: string };

export async function assignToProject(
  subOrgId: string,
  _prev: AssignState,
  fd: FormData,
): Promise<AssignState> {
  await requireRole(ASSIGN_ROLES);
  const projectId = fd.get("projectId") as string | null;
  if (!projectId) return { error: "Select a project" };

  try {
    await prisma.projectSubcontractor.create({
      data: { projectId, subcontractorOrgId: subOrgId },
    });
  } catch {
    return { error: "Already assigned to this project" };
  }

  revalidatePath(`/subcontractors/${subOrgId}`);
  return {};
}

export async function removeFromProject(subOrgId: string, projectId: string): Promise<void> {
  await requireRole(ASSIGN_ROLES);

  await prisma.projectSubcontractor.deleteMany({
    where: { projectId, subcontractorOrgId: subOrgId },
  });

  revalidatePath(`/subcontractors/${subOrgId}`);
}
