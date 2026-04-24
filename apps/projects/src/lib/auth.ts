import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { ROLE_METADATA, ALL_ROLES } from "@agero/db";

export async function getAppUser() {
  const { userId } = await auth();
  if (!userId) return null;
  return prisma.user.findFirst({ where: { clerkId: userId } });
}

export async function requireAppUser() {
  const user = await getAppUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function requireDirector() {
  const user = await getAppUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "DIRECTOR") redirect("/unauthorized");
  return user;
}

// ─── Role helpers ─────────────────────────────────────────────────────────────

const EDIT_ROLES = [
  "DIRECTOR", "GENERAL_MANAGER", "CONSTRUCTION_MANAGER", "PROJECT_DIRECTOR",
  "FINANCIAL_CONTROLLER", "SENIOR_CONSULTANT_PRECON", "SENIOR_ESTIMATOR",
  "SENIOR_CONTRACTS_ADMIN", "PROJECT_MANAGER_DELIVERY", "PROJECT_MANAGER_FRONTEND",
  "SITE_MANAGER", "CONSULTANT_PRECON", "ESTIMATOR", "CONTRACTS_ADMIN",
  "BUSINESS_DEVELOPER", "BOOKKEEPER",
];

export function canDelete(role: string): boolean {
  return role === "DIRECTOR" || role === "GENERAL_MANAGER";
}

export function canEdit(role: string): boolean {
  return EDIT_ROLES.includes(role);
}

export function canAdmin(role: string): boolean {
  return role === "DIRECTOR" || role === "GENERAL_MANAGER";
}

export async function requireCanEdit() {
  const user = await requireAppUser();
  if (!canEdit(user.role)) redirect("/unauthorized");
  return user;
}

export async function requireCanDelete() {
  const user = await requireAppUser();
  if (!canDelete(user.role)) redirect("/unauthorized");
  return user;
}

// ─── Labels & constants ───────────────────────────────────────────────────────

export const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(ROLE_METADATA).map(([k, v]) => [k, v.label])
);

export { ALL_ROLES, ROLE_METADATA };

export const AGERO_ROLES = ALL_ROLES;
export const ADMIN_MANAGER_ROLES = ["DIRECTOR", "GENERAL_MANAGER", "CONSTRUCTION_MANAGER"] as const;
