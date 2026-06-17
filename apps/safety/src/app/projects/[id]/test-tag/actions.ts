"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { addMonths, TEST_TAG_CYCLE_MONTHS } from "@/lib/s3-registers";

export type TestTagState = { error?: string; ok?: boolean };

async function loadProject(projectId: string, orgId: string) {
  const sp = await prisma.safetyProject.findUnique({
    where: { id: projectId },
    select: { id: true, organisationId: true },
  });
  if (!sp || sp.organisationId !== orgId) return null;
  return sp;
}

export async function addTestTagEntry(
  projectId: string,
  _prev: TestTagState,
  formData: FormData,
): Promise<TestTagState> {
  const user = await requireRole(AGERO_ROLES);
  if (!(await loadProject(projectId, user.organisationId))) return { error: "Project not found." };

  const itemName = (formData.get("itemName") as string)?.trim();
  if (!itemName) return { error: "Item description is required." };

  const lastTestRaw = formData.get("lastTestDate") as string | null;
  if (!lastTestRaw) return { error: "Last test date is required." };
  const lastTestDate = new Date(lastTestRaw);
  const nextTestDate = addMonths(lastTestDate, TEST_TAG_CYCLE_MONTHS);

  await prisma.testTagRegister.create({
    data: {
      projectId,
      itemName,
      owner: (formData.get("owner") as string)?.trim() || null,
      location: (formData.get("location") as string)?.trim() || null,
      tagColour: (formData.get("tagColour") as string)?.trim() || null,
      testedBy: (formData.get("testedBy") as string)?.trim() || null,
      lastTestDate,
      nextTestDate,
      addedById: user.id,
      addedByName: user.name ?? user.email,
    },
  });

  revalidatePath(`/projects/${projectId}/test-tag`);
  return { ok: true };
}

export async function retestItem(projectId: string, entryId: string, formData: FormData): Promise<void> {
  const user = await requireRole(AGERO_ROLES);
  if (!(await loadProject(projectId, user.organisationId))) return;
  const dateRaw = (formData.get("retestDate") as string) || new Date().toISOString().slice(0, 10);
  const lastTestDate = new Date(dateRaw);
  await prisma.testTagRegister.updateMany({
    where: { id: entryId, projectId },
    data: { lastTestDate, nextTestDate: addMonths(lastTestDate, TEST_TAG_CYCLE_MONTHS) },
  });
  revalidatePath(`/projects/${projectId}/test-tag`);
}

export async function deleteTestTagEntry(projectId: string, entryId: string): Promise<void> {
  const user = await requireRole(AGERO_ROLES);
  if (!(await loadProject(projectId, user.organisationId))) return;
  await prisma.testTagRegister.deleteMany({ where: { id: entryId, projectId } });
  revalidatePath(`/projects/${projectId}/test-tag`);
}
