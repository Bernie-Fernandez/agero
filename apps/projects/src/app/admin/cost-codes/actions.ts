"use server";

import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CostCodeType } from "@agero/db";

const VALID_TYPES: CostCodeType[] = [
  "REVENUE", "TIME_CODE", "JOB_COST", "PRELIMINARIES", "OVERHEAD", "RETENTION",
];

export async function createCostCode(formData: FormData) {
  const user = await requireDirector();

  const catCode = (formData.get("catCode") as string).trim();
  const groupCode = (formData.get("groupCode") as string).trim();
  const groupName = (formData.get("groupName") as string).trim();
  const codeDescription = (formData.get("codeDescription") as string).trim();
  const codeType = formData.get("codeType") as CostCodeType;
  const glCode = (formData.get("glCode") as string | null)?.trim() || null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;
  const isTradeCategory = formData.get("isTradeCategory") === "true";

  if (!catCode || !groupCode || !groupName || !codeDescription || !VALID_TYPES.includes(codeType)) {
    redirect("/admin/cost-codes/new?error=missing-fields");
  }

  await prisma.costCode.create({
    data: {
      organisationId: user.organisationId,
      catCode,
      groupCode,
      groupName,
      codeDescription,
      codeType,
      glCode,
      notes,
      isTradeCategory,
      isActive: true,
    },
  });

  revalidatePath("/admin/cost-codes");
  redirect("/admin/cost-codes");
}

export async function updateCostCode(id: string, formData: FormData) {
  await requireDirector();

  const codeDescription = (formData.get("codeDescription") as string).trim();
  const groupCode = (formData.get("groupCode") as string).trim();
  const groupName = (formData.get("groupName") as string).trim();
  const codeType = formData.get("codeType") as CostCodeType;
  const glCode = (formData.get("glCode") as string | null)?.trim() || null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;
  const isTradeCategory = formData.get("isTradeCategory") === "true";

  await prisma.costCode.update({
    where: { id },
    data: { codeDescription, groupCode, groupName, codeType, glCode, notes, isTradeCategory },
  });

  revalidatePath("/admin/cost-codes");
  redirect("/admin/cost-codes");
}

export async function toggleCostCodeActive(id: string, isActive: boolean) {
  await requireDirector();
  await prisma.costCode.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/cost-codes");
}

export async function deleteCostCode(id: string) {
  await requireDirector();
  await prisma.costCode.delete({ where: { id } });
  revalidatePath("/admin/cost-codes");
  redirect("/admin/cost-codes");
}
