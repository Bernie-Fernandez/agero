"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireRole, AGERO_ROLES } from "@/lib/auth";

export type PlantState = { error?: string; ok?: boolean };

export interface PlantPreStartDay {
  date: string; // yyyy-mm-dd
  weekday: string;
  completed: boolean;
  operatorName: string;
  faultFound: boolean;
  notes: string;
}

async function loadProject(projectId: string, orgId: string) {
  const sp = await prisma.safetyProject.findUnique({
    where: { id: projectId },
    select: { id: true, organisationId: true },
  });
  if (!sp || sp.organisationId !== orgId) return null;
  return sp;
}

/** Get (or lazily create) the project's plant register id. */
async function ensureRegister(projectId: string, userId: string): Promise<string> {
  const existing = await prisma.plantRegister.findUnique({
    where: { projectId },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.plantRegister.create({
    data: { projectId, createdById: userId },
    select: { id: true },
  });
  return created.id;
}

export async function addPlantItem(
  projectId: string,
  _prev: PlantState,
  formData: FormData,
): Promise<PlantState> {
  const user = await requireRole(AGERO_ROLES);
  if (!(await loadProject(projectId, user.organisationId))) return { error: "Project not found." };

  const plantType = (formData.get("plantType") as string)?.trim();
  if (!plantType) return { error: "Plant type is required." };

  const registerId = await ensureRegister(projectId, user.id);
  const lastServiceRaw = formData.get("lastServiceDate") as string | null;
  const nextServiceRaw = formData.get("nextServiceDate") as string | null;

  await prisma.plantItem.create({
    data: {
      registerId,
      projectId,
      plantType,
      make: (formData.get("make") as string)?.trim() || null,
      model: (formData.get("model") as string)?.trim() || null,
      serialNumber: (formData.get("serialNumber") as string)?.trim() || null,
      registrationNumber: (formData.get("registrationNumber") as string)?.trim() || null,
      owner: (formData.get("owner") as string)?.trim() || null,
      lastServiceDate: lastServiceRaw ? new Date(lastServiceRaw) : null,
      nextServiceDate: nextServiceRaw ? new Date(nextServiceRaw) : null,
      status: "OPERATIONAL",
    },
  });

  revalidatePath(`/projects/${projectId}/plant`);
  return { ok: true };
}

export async function reportFault(projectId: string, itemId: string, formData: FormData): Promise<void> {
  const user = await requireRole(AGERO_ROLES);
  if (!(await loadProject(projectId, user.organisationId))) return;
  const notes = (formData.get("faultNotes") as string)?.trim() || "Fault reported";
  await prisma.plantItem.updateMany({
    where: { id: itemId, projectId },
    data: { status: "FAULTED", faultNotes: notes, faultReportedAt: new Date() },
  });
  revalidatePath(`/projects/${projectId}/plant`);
  revalidatePath(`/projects/${projectId}/plant/${itemId}`);
}

export async function clearFault(projectId: string, itemId: string): Promise<void> {
  const user = await requireRole(AGERO_ROLES);
  if (!(await loadProject(projectId, user.organisationId))) return;
  await prisma.plantItem.updateMany({
    where: { id: itemId, projectId },
    data: { status: "OPERATIONAL", faultNotes: null, faultReportedAt: null },
  });
  revalidatePath(`/projects/${projectId}/plant`);
  revalidatePath(`/projects/${projectId}/plant/${itemId}`);
}

export async function deletePlantItem(projectId: string, itemId: string): Promise<void> {
  const user = await requireRole(AGERO_ROLES);
  if (!(await loadProject(projectId, user.organisationId))) return;
  await prisma.plantItem.deleteMany({ where: { id: itemId, projectId } });
  revalidatePath(`/projects/${projectId}/plant`);
}

export async function savePlantPreStart(
  projectId: string,
  itemId: string,
  weekStarting: string,
  _prev: PlantState,
  formData: FormData,
): Promise<PlantState> {
  const user = await requireRole(AGERO_ROLES);
  if (!(await loadProject(projectId, user.organisationId))) return { error: "Project not found." };

  const raw = formData.get("days") as string | null;
  if (!raw) return { error: "Missing data." };
  let days: PlantPreStartDay[];
  try {
    days = JSON.parse(raw) as PlantPreStartDay[];
  } catch {
    return { error: "Invalid data." };
  }

  const item = await prisma.plantItem.findFirst({
    where: { id: itemId, projectId },
    select: { id: true },
  });
  if (!item) return { error: "Plant item not found." };

  const week = new Date(weekStarting);
  await prisma.plantPreStart.upsert({
    where: { plantItemId_weekStarting: { plantItemId: itemId, weekStarting: week } },
    create: { plantItemId: itemId, weekStarting: week, days: days as unknown as Prisma.InputJsonValue, createdById: user.id },
    update: { days: days as unknown as Prisma.InputJsonValue },
  });

  // Any day reporting a fault flags the plant as FAULTED (blocked from use).
  if (days.some((d) => d.faultFound)) {
    const faultNote = days.filter((d) => d.faultFound).map((d) => `${d.weekday}: ${d.notes || "fault recorded"}`).join("; ");
    await prisma.plantItem.update({
      where: { id: itemId },
      data: { status: "FAULTED", faultNotes: faultNote, faultReportedAt: new Date() },
    });
  }

  revalidatePath(`/projects/${projectId}/plant/${itemId}`);
  revalidatePath(`/projects/${projectId}/plant`);
  return { ok: true };
}
