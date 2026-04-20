"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/safety/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function signOutWorker(
  visitId: string,
  projectId: string,
  _formData: FormData,
): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  await prisma.siteVisit.update({
    where: { id: visitId },
    data: { signedOutAt: new Date() },
  });

  revalidatePath(`/projects/${projectId}/attendance`);
}

export async function verifyVisit(
  visitId: string,
  projectId: string,
  _formData: FormData,
): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const appUser = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { name: true, email: true },
  });

  await prisma.siteVisit.update({
    where: { id: visitId },
    data: {
      verified: true,
      verifiedBy: appUser?.name ?? appUser?.email ?? "Safety Manager",
      verifiedAt: new Date(),
    },
  });

  await prisma.verificationAlert.updateMany({
    where: { siteVisitId: visitId },
    data: { verifiedAt: new Date() },
  });

  revalidatePath(`/projects/${projectId}/attendance`);
}
