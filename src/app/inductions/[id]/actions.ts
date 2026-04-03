"use server";

import { prisma } from "@/lib/prisma";

type Question = {
  question: string;
  options: string[];
  correctAnswer: number;
};

export type InductionSubmitState = {
  error?: string;
  passed?: boolean;
  score?: number;
  total?: number;
};

export async function submitInduction(
  templateId: string,
  workerId: string,
  _prev: InductionSubmitState,
  formData: FormData,
): Promise<InductionSubmitState> {
  const template = await prisma.inductionTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) return { error: "Induction not found." };

  const questions = template.questions as Question[];

  let correct = 0;
  for (let i = 0; i < questions.length; i++) {
    const answer = Number(formData.get(`q${i}`));
    if (answer === questions[i].correctAnswer) correct++;
  }

  const total = questions.length;
  const score = total > 0 ? Math.round((correct / total) * 100) : 100;
  const passed = score >= 80;

  await prisma.inductionCompletion.upsert({
    where: { workerId_templateId: { workerId, templateId } },
    update: { score, passed, signedAt: new Date() },
    create: { workerId, templateId, score, passed, signedAt: new Date() },
  });

  return { passed, score, total };
}
