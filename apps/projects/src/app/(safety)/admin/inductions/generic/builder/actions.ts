"use server";

import { prisma } from "@/lib/safety/prisma";
import { redirect } from "next/navigation";
import { requireRole, ADMIN_MANAGER_ROLES } from "@/lib/safety/auth";
import type { InductionBuilderState } from "@/app/(safety)/projects/[id]/induction/induction-builder";

export async function saveGenericInduction(
  _prev: InductionBuilderState,
  formData: FormData,
): Promise<InductionBuilderState> {
  await requireRole(ADMIN_MANAGER_ROLES);

  const title = formData.get("title")?.toString().trim();
  if (!title) return { error: "Title is required." };

  const questionsRaw = formData.get("questions")?.toString();
  let questions: unknown;
  try {
    questions = questionsRaw ? JSON.parse(questionsRaw) : [];
  } catch {
    return { error: "Invalid questions JSON." };
  }

  const videoUrl = formData.get("videoUrl")?.toString().trim() || null;

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
    data: {
      title,
      type: "generic",
      version: nextVersion,
      questions: questions as object[],
      isActive: true,
      videoUrl,
    },
  });

  redirect(`/admin/inductions/generic/builder?saved=${template.id}`);
}
