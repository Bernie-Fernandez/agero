"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { DEFAULT_COMPLEXITY_TEMPLATES } from "@/app/projects/[id]/pre-start/constants";
import { revalidatePath } from "next/cache";

export type TemplateFormState = { error?: string; success?: boolean };

export async function seedDefaultTemplates(_formData: FormData): Promise<void> {
  const user = await requireRole(["admin"]);

  const existing = await prisma.complexityTemplate.count({
    where: { organisationId: user.organisationId },
  });
  if (existing > 0) return;

  await prisma.complexityTemplate.createMany({
    data: DEFAULT_COMPLEXITY_TEMPLATES.map((t) => ({
      organisationId: user.organisationId,
      name: t.name,
      riskLevel: t.riskLevel,
      safetyPlanning: t.safetyPlanning,
      hrwFlag: t.hrwFlag,
      tradeCategory: t.tradeCategory,
      sortOrder: t.sortOrder,
    })),
  });

  revalidatePath("/admin/complexity-templates");
}

export async function createTemplate(
  _prev: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const user = await requireRole(["admin"]);

  const name = formData.get("name")?.toString().trim();
  const riskLevel = formData.get("riskLevel")?.toString().trim();
  const safetyPlanning = formData.get("safetyPlanning")?.toString().trim();
  const hrwFlag = formData.get("hrwFlag")?.toString().trim() || null;
  const tradeCategory = formData.get("tradeCategory")?.toString().trim() || null;

  if (!name) return { error: "Name is required." };
  if (!riskLevel) return { error: "Risk level is required." };
  if (!safetyPlanning) return { error: "Safety planning is required." };

  const last = await prisma.complexityTemplate.findFirst({
    where: { organisationId: user.organisationId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.complexityTemplate.create({
    data: {
      organisationId: user.organisationId,
      name,
      riskLevel,
      safetyPlanning,
      hrwFlag,
      tradeCategory,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath("/admin/complexity-templates");
  return { success: true };
}

export async function archiveTemplate(id: string): Promise<void> {
  await requireRole(["admin"]);
  await prisma.complexityTemplate.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/admin/complexity-templates");
}

export async function restoreTemplate(id: string): Promise<void> {
  await requireRole(["admin"]);
  await prisma.complexityTemplate.update({ where: { id }, data: { isActive: true } });
  revalidatePath("/admin/complexity-templates");
}
