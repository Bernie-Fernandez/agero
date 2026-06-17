"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, AGERO_ROLES } from "@/lib/auth";

export type PpeLoanState = { error?: string; ok?: boolean };

async function loadProject(projectId: string, orgId: string) {
  const sp = await prisma.safetyProject.findUnique({
    where: { id: projectId },
    select: { id: true, organisationId: true },
  });
  if (!sp || sp.organisationId !== orgId) return null;
  return sp;
}

export async function addPpeLoan(
  projectId: string,
  _prev: PpeLoanState,
  formData: FormData,
): Promise<PpeLoanState> {
  const user = await requireRole(AGERO_ROLES);
  if (!(await loadProject(projectId, user.organisationId))) return { error: "Project not found." };

  const itemName = (formData.get("itemName") as string)?.trim();
  const borrowerName = (formData.get("borrowerName") as string)?.trim();
  if (!itemName) return { error: "Item is required." };
  if (!borrowerName) return { error: "Borrower name is required." };

  const loanedRaw = formData.get("loanedAt") as string | null;
  const dueRaw = formData.get("dueDate") as string | null;

  await prisma.pPELoanRegister.create({
    data: {
      projectId,
      itemName,
      borrowerName,
      company: (formData.get("company") as string)?.trim() || null,
      licenceNumber: (formData.get("licenceNumber") as string)?.trim() || null,
      deposit: (formData.get("deposit") as string)?.trim() || null,
      loanedAt: loanedRaw ? new Date(loanedRaw) : new Date(),
      dueDate: dueRaw ? new Date(dueRaw) : null,
      status: "ON_LOAN",
      issuedById: user.id,
      issuedByName: user.name ?? user.email,
    },
  });

  revalidatePath(`/projects/${projectId}/ppe-loans`);
  return { ok: true };
}

export async function markReturned(projectId: string, loanId: string): Promise<void> {
  const user = await requireRole(AGERO_ROLES);
  if (!(await loadProject(projectId, user.organisationId))) return;
  await prisma.pPELoanRegister.updateMany({
    where: { id: loanId, projectId },
    data: { status: "RETURNED", returnedAt: new Date() },
  });
  revalidatePath(`/projects/${projectId}/ppe-loans`);
}

export async function deletePpeLoan(projectId: string, loanId: string): Promise<void> {
  const user = await requireRole(AGERO_ROLES);
  if (!(await loadProject(projectId, user.organisationId))) return;
  await prisma.pPELoanRegister.deleteMany({ where: { id: loanId, projectId } });
  revalidatePath(`/projects/${projectId}/ppe-loans`);
}
