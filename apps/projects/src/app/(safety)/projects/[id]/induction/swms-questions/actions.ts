"use server";

import { prisma } from "@/lib/safety/prisma";
import { requireRole, AGERO_ROLES } from "@/lib/safety/auth";
import { SwmsQuestionStatus } from "@/generated/safety-prisma/client";
import { revalidatePath } from "next/cache";

export type SwmsQuestionActionState = { error?: string; success?: boolean };

export async function reviewSwmsQuestion(
  projectId: string,
  questionId: string,
  status: SwmsQuestionStatus,
  _prev: SwmsQuestionActionState,
  _formData: FormData,
): Promise<SwmsQuestionActionState> {
  const appUser = await requireRole(AGERO_ROLES);

  const question = await prisma.swmsInductionQuestion.findUnique({
    where: { id: questionId },
    include: { project: true },
  });

  if (!question || question.project.organisationId !== appUser.organisationId) {
    return { error: "Question not found." };
  }

  await prisma.swmsInductionQuestion.update({
    where: { id: questionId },
    data: { status },
  });

  revalidatePath(`/projects/${projectId}/induction/swms-questions`);
  return { success: true };
}
