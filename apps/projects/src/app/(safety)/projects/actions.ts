"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/safety/prisma";
import { redirect } from "next/navigation";

export type ProjectFormState = { error?: string; projectId?: string };

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
  const startDateRaw = formData.get("startDate")?.toString();
  const endDateRaw = formData.get("endDate")?.toString();

  if (!name) return { error: "Project name is required." };

  const project = await prisma.project.create({
    data: {
      name,
      address,
      organisationId: appUser.organisationId,
      startDate: startDateRaw ? new Date(startDateRaw) : null,
      endDate: endDateRaw ? new Date(endDateRaw) : null,
    },
  });

  return { projectId: project.id };
}
