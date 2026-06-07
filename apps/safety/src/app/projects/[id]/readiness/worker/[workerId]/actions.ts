"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type WorkerEditState = { error?: string; success?: string };
export type BldgMgmtState = { error?: string; success?: string };

export async function updateWorkerMobReadiness(
  safetyProjectId: string,
  workerId: string,
  _prev: WorkerEditState,
  fd: FormData,
): Promise<WorkerEditState> {
  const user = await requireRole(AGERO_ROLES);

  // Verify safety project belongs to this org
  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id: safetyProjectId },
    select: { organisationId: true, erpProjectId: true },
  });
  if (!safetyProject) {
    return { error: "Not found." };
  }

  // Verify worker belongs to this ERP project
  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: { projectId: true },
  });
  if (!worker || worker.projectId !== safetyProject.erpProjectId) {
    return { error: "Worker not found on this project." };
  }

  const whiteCardNo = fd.get("whiteCardNo")?.toString().trim() || null;
  const whiteCardExpiry = fd.get("whiteCardExpiry")?.toString() || null;
  const nokName = fd.get("nokName")?.toString().trim() || null;
  const nokPhone = fd.get("nokPhone")?.toString().trim() || null;
  const nokRelationship = fd.get("nokRelationship")?.toString().trim() || null;

  await prisma.worker.update({
    where: { id: workerId },
    data: {
      whiteCardNo,
      whiteCardExpiry: whiteCardExpiry ? new Date(whiteCardExpiry) : null,
      nokName,
      nokPhone,
      nokRelationship,
    },
  });

  revalidatePath(`/projects/${safetyProjectId}/readiness`);
  return { success: "Worker record updated." };
}

async function resolveContext(safetyProjectId: string, workerId: string) {
  const user = await requireRole(AGERO_ROLES);
  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id: safetyProjectId },
    select: { organisationId: true, erpProjectId: true },
  });
  if (!safetyProject) return null;
  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: { projectId: true, mobile: true },
  });
  if (!worker || worker.projectId !== safetyProject.erpProjectId) return null;
  return { safetyProject, worker };
}

export async function markBuildingMgmtComplete(
  safetyProjectId: string,
  workerId: string,
  _prev: BldgMgmtState,
  fd: FormData,
): Promise<BldgMgmtState> {
  const ctx = await resolveContext(safetyProjectId, workerId);
  if (!ctx) return { error: "Not found." };

  const completedByName = fd.get("completedByName")?.toString().trim();
  if (!completedByName) return { error: "Please enter the name of who conducted the induction." };

  const completedAtRaw = fd.get("completedAt")?.toString();
  const completedAt = completedAtRaw ? new Date(completedAtRaw) : new Date();

  if (!ctx.worker.mobile) return { error: "Worker has no mobile number — cannot link to account." };

  const workerAccount = await prisma.workerAccount.findUnique({
    where: { mobile: ctx.worker.mobile },
    select: { id: true },
  });
  if (!workerAccount) {
    return { error: "Worker has not registered a WorkerAccount. They must sign in via SMS first." };
  }

  await prisma.buildingMgmtInduction.upsert({
    where: { projectId_workerAccountId: { projectId: safetyProjectId, workerAccountId: workerAccount.id } },
    create: { projectId: safetyProjectId, workerAccountId: workerAccount.id, completedAt, completedByName },
    update: { completedAt, completedByName },
  });

  revalidatePath(`/projects/${safetyProjectId}/readiness`);
  revalidatePath(`/projects/${safetyProjectId}/readiness/worker/${workerId}`);
  return { success: "Building management induction recorded." };
}

export async function removeBuildingMgmtComplete(
  safetyProjectId: string,
  workerId: string,
  _prev: BldgMgmtState,
  _fd: FormData,
): Promise<BldgMgmtState> {
  const ctx = await resolveContext(safetyProjectId, workerId);
  if (!ctx) return { error: "Not found." };

  if (!ctx.worker.mobile) return { error: "Worker has no mobile number." };

  const workerAccount = await prisma.workerAccount.findUnique({
    where: { mobile: ctx.worker.mobile },
    select: { id: true },
  });
  if (!workerAccount) return { error: "WorkerAccount not found." };

  await prisma.buildingMgmtInduction.deleteMany({
    where: { projectId: safetyProjectId, workerAccountId: workerAccount.id },
  });

  revalidatePath(`/projects/${safetyProjectId}/readiness`);
  revalidatePath(`/projects/${safetyProjectId}/readiness/worker/${workerId}`);
  return { success: "Building management induction record removed." };
}
