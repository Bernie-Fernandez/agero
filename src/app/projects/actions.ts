"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export type ProjectFormState = { error?: string };

export async function createProject(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const appUser = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (!appUser) redirect("/onboarding");

  const name = formData.get("name")?.toString().trim();
  const address = formData.get("address")?.toString().trim() || null;

  if (!name) return { error: "Project name is required." };

  await prisma.project.create({
    data: { name, address, organisationId: appUser.organisationId },
  });

  redirect("/projects");
}
