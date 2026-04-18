"use server";

import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createPaymentTerm(formData: FormData) {
  const user = await requireDirector();

  const name = (formData.get("name") as string).trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const isDefault = formData.get("isDefault") === "true";
  const displayOrderRaw = formData.get("displayOrder") as string;
  const displayOrder = displayOrderRaw ? parseInt(displayOrderRaw, 10) : null;

  if (!name) redirect("/admin/payment-terms/new?error=missing-name");

  // If setting as default, clear existing default first
  if (isDefault) {
    await prisma.paymentTerm.updateMany({
      where: { organisationId: user.organisationId, isDefault: true },
      data: { isDefault: false },
    });
  }

  await prisma.paymentTerm.create({
    data: { organisationId: user.organisationId, name, description, isDefault, displayOrder, isActive: true },
  });

  revalidatePath("/admin/payment-terms");
  redirect("/admin/payment-terms");
}

export async function updatePaymentTerm(id: string, formData: FormData) {
  const user = await requireDirector();

  const name = (formData.get("name") as string).trim();
  const description = (formData.get("description") as string | null)?.trim() || null;
  const isDefault = formData.get("isDefault") === "true";
  const displayOrderRaw = formData.get("displayOrder") as string;
  const displayOrder = displayOrderRaw ? parseInt(displayOrderRaw, 10) : null;

  if (!name) redirect(`/admin/payment-terms/${id}/edit?error=missing-name`);

  if (isDefault) {
    await prisma.paymentTerm.updateMany({
      where: { organisationId: user.organisationId, isDefault: true, NOT: { id } },
      data: { isDefault: false },
    });
  }

  await prisma.paymentTerm.update({
    where: { id },
    data: { name, description, isDefault, displayOrder },
  });

  revalidatePath("/admin/payment-terms");
  redirect("/admin/payment-terms");
}

export async function togglePaymentTermActive(id: string, isActive: boolean) {
  await requireDirector();
  await prisma.paymentTerm.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/payment-terms");
}

export async function deletePaymentTerm(id: string) {
  await requireDirector();
  await prisma.paymentTerm.delete({ where: { id } });
  revalidatePath("/admin/payment-terms");
  redirect("/admin/payment-terms");
}
