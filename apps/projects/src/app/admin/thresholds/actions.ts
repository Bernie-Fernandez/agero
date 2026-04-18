"use server";

import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AlertThresholdType } from "@agero/db";

const VALID_TYPES: AlertThresholdType[] = ["INSURANCE_EXPIRY", "DOCUMENT_EXPIRY"];

export async function createThreshold(formData: FormData) {
  const user = await requireDirector();

  const alertType = formData.get("alertType") as AlertThresholdType;
  const daysBeforeRaw = formData.get("daysBefore") as string;
  const daysBefore = parseInt(daysBeforeRaw, 10);

  if (!VALID_TYPES.includes(alertType) || isNaN(daysBefore) || daysBefore < 1) {
    redirect("/admin/thresholds/new?error=invalid");
  }

  await prisma.alertThreshold.create({
    data: { organisationId: user.organisationId, alertType, daysBefore, isActive: true },
  });

  revalidatePath("/admin/thresholds");
  redirect("/admin/thresholds");
}

export async function toggleThreshold(id: string, isActive: boolean) {
  await requireDirector();
  await prisma.alertThreshold.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/thresholds");
}

export async function deleteThreshold(id: string) {
  await requireDirector();
  await prisma.alertThreshold.delete({ where: { id } });
  revalidatePath("/admin/thresholds");
  redirect("/admin/thresholds");
}
