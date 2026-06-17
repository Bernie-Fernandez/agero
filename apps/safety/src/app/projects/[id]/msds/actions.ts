"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, AGERO_ROLES } from "@/lib/auth";

export type MsdsState = { error?: string; ok?: boolean };

async function loadProject(projectId: string, orgId: string) {
  const sp = await prisma.safetyProject.findUnique({
    where: { id: projectId },
    select: { id: true, organisationId: true },
  });
  if (!sp || sp.organisationId !== orgId) return null;
  return sp;
}

export async function addMsdsEntry(
  projectId: string,
  _prev: MsdsState,
  formData: FormData,
): Promise<MsdsState> {
  const user = await requireRole(AGERO_ROLES);
  if (!(await loadProject(projectId, user.organisationId))) return { error: "Project not found." };

  const productName = (formData.get("productName") as string)?.trim();
  if (!productName) return { error: "Product name is required." };

  const issueRaw = formData.get("msdsIssueDate") as string | null;

  await prisma.mSDSRegister.create({
    data: {
      projectId,
      productName,
      manufacturer: (formData.get("manufacturer") as string)?.trim() || null,
      location: (formData.get("location") as string)?.trim() || null,
      hazardous: formData.get("hazardous") === "on",
      dangerousGoods: formData.get("dangerousGoods") === "on",
      dgClass: (formData.get("dgClass") as string)?.trim() || null,
      msdsIssueDate: issueRaw ? new Date(issueRaw) : null,
      msdsUrl: (formData.get("msdsUrl") as string)?.trim() || null,
      riskAssessment: (formData.get("riskAssessment") as string)?.trim() || null,
      controls: [],
      addedById: user.id,
      addedByName: user.name ?? user.email,
    },
  });

  revalidatePath(`/projects/${projectId}/msds`);
  return { ok: true };
}

export async function deleteMsdsEntry(projectId: string, entryId: string): Promise<void> {
  const user = await requireRole(AGERO_ROLES);
  if (!(await loadProject(projectId, user.organisationId))) return;
  await prisma.mSDSRegister.deleteMany({ where: { id: entryId, projectId } });
  revalidatePath(`/projects/${projectId}/msds`);
}
