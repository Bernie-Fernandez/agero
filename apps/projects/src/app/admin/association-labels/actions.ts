"use server";

import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const VALID_TYPES = ["COMPANY", "PROJECT", "CONTACT"] as const;

export async function createAssociationLabel(formData: FormData) {
  const user = await requireDirector();
  const name = (formData.get("name") as string)?.trim();
  const associationType = (formData.get("associationType") as string)?.trim();
  if (!name) redirect("/admin/association-labels/new?error=missing-name");
  if (!VALID_TYPES.includes(associationType as (typeof VALID_TYPES)[number])) {
    redirect("/admin/association-labels/new?error=invalid-type");
  }
  await prisma.associationLabel.create({
    data: {
      organisationId: user.organisationId,
      name,
      associationType,
      isActive: true,
    },
  });
  revalidatePath("/admin/association-labels");
  redirect("/admin/association-labels");
}

export async function updateAssociationLabel(id: string, formData: FormData) {
  await requireDirector();
  const name = (formData.get("name") as string)?.trim();
  if (!name) redirect(`/admin/association-labels/${id}/edit?error=missing-name`);
  await prisma.associationLabel.update({
    where: { id },
    data: { name },
  });
  revalidatePath("/admin/association-labels");
  redirect("/admin/association-labels");
}

export async function toggleAssociationLabelActive(id: string, isActive: boolean) {
  await requireDirector();
  await prisma.associationLabel.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/association-labels");
}

export async function deleteAssociationLabel(id: string) {
  await requireDirector();
  await prisma.associationLabel.delete({ where: { id } });
  revalidatePath("/admin/association-labels");
}

export async function seedDefaultAssociationLabels() {
  const user = await requireDirector();
  const org = await prisma.organisation.findFirst({ select: { id: true } });
  if (!org) return;

  const existing = await prisma.associationLabel.count({ where: { organisationId: org.id } });
  if (existing > 0) return;

  const defaults = [
    // COMPANY type
    { name: "Current Primary Company", associationType: "COMPANY" },
    { name: "Previous Company / Former Employee", associationType: "COMPANY" },
    { name: "Private / Personal", associationType: "COMPANY" },
    // PROJECT type
    { name: "Client Representative", associationType: "PROJECT" },
    { name: "Project Sponsor", associationType: "PROJECT" },
    { name: "Stakeholder", associationType: "PROJECT" },
    { name: "Project Advisor", associationType: "PROJECT" },
    { name: "Principal's Representative", associationType: "PROJECT" },
    // CONTACT type
    { name: "Colleague", associationType: "CONTACT" },
    { name: "Friend", associationType: "CONTACT" },
    { name: "Referral", associationType: "CONTACT" },
  ];

  await prisma.associationLabel.createMany({
    data: defaults.map((d) => ({
      organisationId: org.id,
      ...d,
      isActive: true,
    })),
  });

  revalidatePath("/admin/association-labels");
}
