"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { createStorageAdminClient } from "@/lib/supabase/server";
import { DocumentType } from "@/generated/prisma/client";

export type InductionFormState = { error?: string; success?: boolean };

export async function saveInductionTemplate(
  projectId: string,
  _prev: InductionFormState,
  formData: FormData,
): Promise<InductionFormState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const appUser = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (!appUser) redirect("/onboarding");

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.organisationId !== appUser.organisationId) {
    return { error: "Project not found." };
  }

  const questionsRaw = formData.get("questions")?.toString();
  let questions: unknown[];
  try {
    const parsed = questionsRaw ? JSON.parse(questionsRaw) : [];
    if (!Array.isArray(parsed)) return { error: "Invalid questions data." };
    questions = parsed;
  } catch {
    return { error: "Invalid questions JSON." };
  }

  if (questions.length === 0) return { error: "At least one question is required." };

  // Validate each question
  for (const raw of questions) {
    const q = raw as Record<string, unknown>;
    if (!q.question || typeof q.question !== "string" || !q.question.trim()) {
      return { error: "All questions must have question text." };
    }
    if (q.type === "multiple_choice") {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        return { error: "Multiple choice questions must have at least 2 options." };
      }
      if (!Array.isArray(q.correctAnswers) || q.correctAnswers.length === 0) {
        return { error: "Multiple choice questions must have at least one correct answer marked." };
      }
    }
    // short_answer: question text is sufficient; expectedAnswerContext recommended but not blocking
  }

  const videoUrl = formData.get("videoUrl")?.toString().trim() || null;

  // Deactivate previous version
  const existing = await prisma.inductionTemplate.findFirst({
    where: { projectId, type: "site_specific", isActive: true },
    orderBy: { version: "desc" },
  });

  const nextVersion = existing ? existing.version + 1 : 1;

  // Auto-generate title: "[Project Name] — Site Induction v[N] — [Month Year]"
  const monthYear = new Date().toLocaleString("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  });
  const title = `${project.name} — Site Induction v${nextVersion} — ${monthYear}`;

  if (existing) {
    await prisma.inductionTemplate.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
  }

  await prisma.inductionTemplate.create({
    data: {
      title,
      type: "site_specific",
      version: nextVersion,
      questions: questions as object[],
      projectId,
      isActive: true,
      videoUrl,
    },
  });

  return { success: true };
}

export async function uploadSwms(
  projectId: string,
  _prev: InductionFormState,
  formData: FormData,
): Promise<InductionFormState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const appUser = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (!appUser) redirect("/onboarding");

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.organisationId !== appUser.organisationId) {
    return { error: "Project not found." };
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Please select a file." };

  const storage = createStorageAdminClient();
  const ext = file.name.split(".").pop();
  const path = `projects/${projectId}/swms-${Date.now()}.${ext}`;

  const { error: storageError } = await storage
    .from("documents")
    .upload(path, file, { upsert: true });

  if (storageError) return { error: `Upload failed: ${storageError.message}` };

  const { data: urlData } = storage.from("documents").getPublicUrl(path);

  const existing = await prisma.documentUpload.findFirst({
    where: { projectId, type: DocumentType.swms },
    select: { id: true },
  });

  if (existing) {
    await prisma.documentUpload.update({
      where: { id: existing.id },
      data: { url: urlData.publicUrl },
    });
  } else {
    await prisma.documentUpload.create({
      data: { projectId, type: DocumentType.swms, url: urlData.publicUrl },
    });
  }

  return { success: true };
}
