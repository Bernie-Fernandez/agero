"use server";

import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createExpertiseTag(formData: FormData) {
  const user = await requireDirector();

  const name = (formData.get("name") as string).trim();
  const category = (formData.get("category") as string).trim();

  if (!name || !category) redirect("/admin/expertise-tags/new?error=missing-fields");

  await prisma.expertiseTag.create({
    data: { organisationId: user.organisationId, name, category, isActive: true },
  });

  revalidatePath("/admin/expertise-tags");
  redirect("/admin/expertise-tags");
}

export async function updateExpertiseTag(id: string, formData: FormData) {
  await requireDirector();

  const name = (formData.get("name") as string).trim();
  const category = (formData.get("category") as string).trim();

  if (!name || !category) redirect(`/admin/expertise-tags/${id}/edit?error=missing-fields`);

  await prisma.expertiseTag.update({ where: { id }, data: { name, category } });

  revalidatePath("/admin/expertise-tags");
  redirect("/admin/expertise-tags");
}

export async function toggleExpertiseTagActive(id: string, isActive: boolean) {
  await requireDirector();
  await prisma.expertiseTag.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/expertise-tags");
}

export async function deleteExpertiseTag(id: string) {
  await requireDirector();
  await prisma.expertiseTag.delete({ where: { id } });
  revalidatePath("/admin/expertise-tags");
  redirect("/admin/expertise-tags");
}
