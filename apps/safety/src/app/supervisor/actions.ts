"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function escalateAlert(
  alertId: string,
  _formData: FormData,
): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  await prisma.verificationAlert.update({
    where: { id: alertId },
    data: { escalatedAt: new Date() },
  });

  revalidatePath("/supervisor");
}
