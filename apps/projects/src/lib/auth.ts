import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";

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

// ─── Role Permission Helpers ──────────────────────────────────────────────────

/** Roles that can add and edit records */
export const EDIT_ROLES = [
  "DIRECTOR",
  "CONSTRUCTION_MANAGER",
  "PROJECT_MANAGER",
  "CONTRACTS_ADMINISTRATOR",
  "ESTIMATOR",
];

/** Only Directors can delete records or blacklist */
export function canDelete(role: string): boolean {
  return role === "DIRECTOR";
}

/** Director + Construction Manager + PM + CA + Estimator can edit */
export function canEdit(role: string): boolean {
  return EDIT_ROLES.includes(role);
}

/** Only Directors can access admin panel */
export function canAdmin(role: string): boolean {
  return role === "DIRECTOR";
}

/** Require edit capability — use in server actions that mutate data */
export async function requireCanEdit() {
  const user = await requireAppUser();
  if (!canEdit(user.role)) redirect("/unauthorized");
  return user;
}

/** Require delete capability — use in server actions that delete records */
export async function requireCanDelete() {
  const user = await requireAppUser();
  if (!canDelete(user.role)) redirect("/unauthorized");
  return user;
}

// ─── Labels ───────────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<string, string> = {
  DIRECTOR: "Director",
  CONSTRUCTION_MANAGER: "Construction Manager",
  PROJECT_MANAGER: "Project Manager",
  CONTRACTS_ADMINISTRATOR: "Contracts Administrator",
  ESTIMATOR: "Estimator",
  SITE_MANAGER: "Site Manager",
  FINANCIAL_CONTROLLER: "Financial Controller",
  ADMINISTRATOR: "Administrator",
};

export const ALL_ROLES = [
  "DIRECTOR",
  "CONSTRUCTION_MANAGER",
  "PROJECT_MANAGER",
  "CONTRACTS_ADMINISTRATOR",
  "ESTIMATOR",
  "SITE_MANAGER",
  "FINANCIAL_CONTROLLER",
  "ADMINISTRATOR",
] as const;
