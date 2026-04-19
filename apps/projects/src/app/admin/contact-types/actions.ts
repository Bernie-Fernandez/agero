"use server";

import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createContactType(formData: FormData) {
  const user = await requireDirector();

  const name = (formData.get("name") as string).trim();
  const isSubType = formData.get("isSubType") === "true";
  const displayOrderRaw = formData.get("displayOrder") as string;
  const displayOrder = displayOrderRaw ? parseInt(displayOrderRaw, 10) : null;

  if (!name) redirect("/admin/contact-types/new?error=missing-name");

  await prisma.contactType.create({
    data: { organisationId: user.organisationId, name, isSubType, displayOrder, isActive: true },
  });

  revalidatePath("/admin/contact-types");
  redirect("/admin/contact-types");
}

export async function updateContactType(id: string, formData: FormData) {
  await requireDirector();

  const name = (formData.get("name") as string).trim();
  const displayOrderRaw = formData.get("displayOrder") as string;
  const displayOrder = displayOrderRaw ? parseInt(displayOrderRaw, 10) : null;

  if (!name) redirect(`/admin/contact-types/${id}/edit?error=missing-name`);

  await prisma.contactType.update({ where: { id }, data: { name, displayOrder } });

  revalidatePath("/admin/contact-types");
  redirect("/admin/contact-types");
}

export async function toggleContactTypeActive(id: string, isActive: boolean) {
  await requireDirector();
  await prisma.contactType.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/contact-types");
}

export async function deleteContactType(id: string) {
  await requireDirector();
  await prisma.contactType.delete({ where: { id } });
  revalidatePath("/admin/contact-types");
  redirect("/admin/contact-types");
}
