"use server";

import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { UserRole } from "@agero/db";

const VALID_ROLES: UserRole[] = ["DIRECTOR", "PROJECT_MANAGER", "SAFETY_MANAGER", "SITE_MANAGER"];

export async function updateUser(id: string, formData: FormData) {
  await requireDirector();

  const firstName = (formData.get("firstName") as string).trim();
  const lastName = (formData.get("lastName") as string).trim();
  const mobile = (formData.get("mobile") as string | null)?.trim() || null;
  const role = formData.get("role") as UserRole;
  const isActive = formData.get("isActive") === "true";

  if (!firstName || !lastName || !VALID_ROLES.includes(role)) {
    redirect(`/admin/users/${id}/edit?error=invalid`);
  }

  await prisma.user.update({
    where: { id },
    data: { firstName, lastName, mobile, role, isActive },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function toggleUserActive(id: string, isActive: boolean) {
  const currentUser = await requireDirector();
  // Prevent Director from deactivating themselves
  if (id === currentUser.id && !isActive) {
    redirect("/admin/users?error=cannot-deactivate-self");
  }
  await prisma.user.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/users");
}
