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

export const ROLE_LABELS: Record<string, string> = {
  DIRECTOR: "Director",
  PROJECT_MANAGER: "Project Manager",
  SAFETY_MANAGER: "Safety Manager",
  SITE_MANAGER: "Site Manager",
};

export const ALL_ROLES = ["DIRECTOR", "PROJECT_MANAGER", "SAFETY_MANAGER", "SITE_MANAGER"] as const;
