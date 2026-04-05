import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/generated/prisma/client";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Director",
  safety_manager: "Safety Manager",
  project_manager: "Project Manager",
  site_manager: "Site Manager",
  subcontractor_admin: "Subcontractor Admin",
};

/** All Agero-internal roles (excludes subcontractor_admin). */
export const AGERO_ROLES: UserRole[] = [
  "admin",
  "safety_manager",
  "project_manager",
  "site_manager",
];

/** Roles that can manage subcontractors and invitations. */
export const ADMIN_MANAGER_ROLES: UserRole[] = ["admin", "safety_manager"];

/**
 * Verifies the current Clerk session, looks up the app user, and checks that
 * their role is in `allowedRoles`. Redirects to /sign-in, /onboarding, or
 * /unauthorized as appropriate. Returns the app user on success.
 */
export async function requireRole(allowedRoles: UserRole[]) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const appUser = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (!appUser) redirect("/onboarding");

  if (!allowedRoles.includes(appUser.role)) redirect("/unauthorized");

  return appUser;
}

/** Like requireRole but accepts any authenticated app user (no role restriction). */
export async function getAppUser() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const appUser = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (!appUser) redirect("/onboarding");

  return appUser;
}
