import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import type { UserRole } from "../../generated/safety-prisma/client";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Director",
  safety_manager: "Safety Manager",
  project_manager: "Project Manager",
  site_manager: "Site Manager",
  subcontractor_admin: "Subcontractor Admin",
};

export const AGERO_ROLES: UserRole[] = [
  "admin",
  "safety_manager",
  "project_manager",
  "site_manager",
];

export const ADMIN_MANAGER_ROLES: UserRole[] = ["admin", "safety_manager"];

export async function requireRole(allowedRoles: UserRole[]) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const appUser = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (!appUser) redirect("/onboarding");

  if (!allowedRoles.includes(appUser.role)) redirect("/unauthorized");

  return appUser;
}

export async function getAppUser() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const appUser = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (!appUser) redirect("/onboarding");

  return appUser;
}
