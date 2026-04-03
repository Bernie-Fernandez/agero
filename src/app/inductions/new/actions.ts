"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export type GenericInductionState = { error?: string; id?: string };

export async function saveGenericInduction(
  _prev: GenericInductionState,
  formData: FormData,
): Promise<GenericInductionState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const appUser = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (!appUser) redirect("/onboarding");

  const title = formData.get("title")?.toString().trim();
  if (!title) return { error: "Title is required." };

  const questionsRaw = formData.get("questions")?.toString();
  let questions: unknown;
  try {
    questions = questionsRaw ? JSON.parse(questionsRaw) : [];
  } catch {
    return { error: "Invalid questions JSON." };
  }

  // Deactivate current active generic induction
  const existing = await prisma.inductionTemplate.findFirst({
    where: { type: "generic", isActive: true },
    orderBy: { version: "desc" },
  });

  const nextVersion = existing ? existing.version + 1 : 1;
  if (existing) {
    await prisma.inductionTemplate.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
  }

  const template = await prisma.inductionTemplate.create({
    data: { title, type: "generic", version: nextVersion, questions: questions as object[], isActive: true },
  });

  redirect(`/inductions/${template.id}`);
}
