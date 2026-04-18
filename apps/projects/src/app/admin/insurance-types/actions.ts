"use server";

import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createInsuranceType(formData: FormData) {
  const user = await requireDirector();

  const name = (formData.get("name") as string).trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const isMandatory = formData.get("isMandatory") === "true";
  const displayOrderRaw = formData.get("displayOrder") as string;
  const displayOrder = displayOrderRaw ? parseInt(displayOrderRaw, 10) : null;

  if (!name) redirect("/admin/insurance-types/new?error=missing-name");

  await prisma.insurancePolicyType.create({
    data: { organisationId: user.organisationId, name, description, isMandatory, displayOrder, isActive: true },
  });

  revalidatePath("/admin/insurance-types");
  redirect("/admin/insurance-types");
}

export async function updateInsuranceType(id: string, formData: FormData) {
  await requireDirector();

  const name = (formData.get("name") as string).trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const isMandatory = formData.get("isMandatory") === "true";
  const displayOrderRaw = formData.get("displayOrder") as string;
  const displayOrder = displayOrderRaw ? parseInt(displayOrderRaw, 10) : null;

  if (!name) redirect(`/admin/insurance-types/${id}/edit?error=missing-name`);

  await prisma.insurancePolicyType.update({
    where: { id },
    data: { name, description, isMandatory, displayOrder },
  });

  revalidatePath("/admin/insurance-types");
  redirect("/admin/insurance-types");
}

export async function toggleInsuranceTypeActive(id: string, isActive: boolean) {
  await requireDirector();
  await prisma.insurancePolicyType.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/insurance-types");
}

export async function deleteInsuranceType(id: string) {
  await requireDirector();
  await prisma.insurancePolicyType.delete({ where: { id } });
  revalidatePath("/admin/insurance-types");
  redirect("/admin/insurance-types");
}
