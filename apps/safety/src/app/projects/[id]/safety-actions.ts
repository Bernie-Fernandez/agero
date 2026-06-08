"use server";

import { requireRole, ADMIN_MANAGER_ROLES } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateMobilisationDate(
  safetyProjectId: string,
  erpProjectId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  await requireRole([...ADMIN_MANAGER_ROLES, "project_manager"]);

  const raw = formData.get("mobilisationDate")?.toString();
  const mobilisationDate = raw ? new Date(raw) : null;

  await prisma.safetyProject.update({
    where: { id: safetyProjectId },
    data: { mobilisationDate },
  });

  revalidatePath(`/projects/${erpProjectId}`);
  return {};
}
