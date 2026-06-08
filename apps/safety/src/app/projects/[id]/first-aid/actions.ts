"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, AGERO_ROLES } from "@/lib/auth";

export type FirstAidState = { error?: string };

export async function saveFirstAidChecklist(
  projectId: string,
  checklistType: string,
  _prev: FirstAidState,
  formData: FormData,
): Promise<FirstAidState> {
  const user = await requireRole(AGERO_ROLES);

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id: projectId },
    select: { id: true, organisationId: true },
  });
  if (!safetyProject || safetyProject.organisationId !== user.organisationId) {
    return { error: "Project not found." };
  }

  const raw = formData.get("items") as string | null;
  if (!raw) return { error: "Missing checklist data." };

  let items: { id: string; description: string; compliant: boolean; notes: string }[];
  try {
    items = JSON.parse(raw);
  } catch {
    return { error: "Invalid checklist data." };
  }

  const notes = (formData.get("notes") as string | null) ?? "";

  await prisma.firstAidChecklist.create({
    data: {
      projectId,
      conductedById: user.id,
      checklistType,
      conductedAt: new Date(),
      items,
      notes: notes || undefined,
    },
  });

  revalidatePath(`/projects/${projectId}/first-aid`);
  redirect(`/projects/${projectId}/first-aid`);
}
