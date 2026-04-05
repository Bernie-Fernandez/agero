"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { sendInductionBlockedAlert } from "@/lib/email";

type Question = {
  question: string;
  type?: "multiple_choice" | "short_answer";
  options?: string[];
  correctAnswers?: number[];
  correctAnswer?: number; // legacy single-answer format
};

function getCorrectAnswers(q: Question): number[] {
  if (Array.isArray(q.correctAnswers) && q.correctAnswers.length > 0) return q.correctAnswers;
  if (typeof q.correctAnswer === "number") return [q.correctAnswer];
  return [];
}

function scoreQuestion(q: Question, formData: FormData, index: number): boolean {
  // Short-answer questions: auto-accept any non-empty response
  if (q.type === "short_answer") {
    const val = formData.get(`q${index}`)?.toString().trim() ?? "";
    return val.length > 0;
  }
  const required = getCorrectAnswers(q).slice().sort((a, b) => a - b);
  const selected = formData.getAll(`q${index}`).map(Number).sort((a, b) => a - b);
  return (
    selected.length > 0 &&
    selected.length === required.length &&
    selected.every((v, j) => v === required[j])
  );
}

/** Parse and validate the lockedCorrect hidden field from FormData. */
function parseLocked(formData: FormData, questionCount: number): number[] {
  const raw = formData.get("lockedCorrect");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw.toString());
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (n: unknown): n is number =>
        typeof n === "number" && Number.isInteger(n) && n >= 0 && n < questionCount,
    );
  } catch {
    return [];
  }
}

export type InductionSubmitState = {
  error?: string;
  // Answer phase
  passed?: boolean;
  score?: number;
  total?: number;
  attemptsLeft?: number; // undefined = not tracked (anonymous); 0 = blocked
  blocked?: boolean;
  blockedUntil?: string; // ISO string
  correctIndices?: number[]; // question indices answered correctly — carry into next attempt
  // key = question index (as string), value = option indices the worker selected last attempt
  previousSelections?: Record<string, number[]>;
  // Signature phase
  needsSignature?: boolean;
  declarationPreview?: {
    workerName: string;
    mobile: string;
    projectName: string;
    templateTitle: string;
    version: number;
    text: string;
  };
};

const MAX_ATTEMPTS = 3;
const BLOCK_DURATION_MS = 24 * 60 * 60 * 1000;

function buildDeclarationText(
  workerName: string,
  projectName: string,
  mobile: string,
  now: Date,
): string {
  const dateStr = now.toLocaleString("en-AU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Australia/Melbourne",
  });
  return (
    `I, ${workerName}, confirm that I have read and understood the Agero Group Work Health & Safety Policy and Procedures, ` +
    `including the Site Specific Safety Plan for ${projectName}. I agree to abide by all safety requirements and will ensure ` +
    `any persons under my supervision are inducted before accessing site. I understand that failure to comply may result in ` +
    `removal from site.\n\n` +
    `Signed electronically by ${workerName} | Mobile: ${mobile} | ${dateStr}`
  );
}

export async function submitInduction(
  templateId: string,
  workerId: string,
  nextUrl: string,
  _prev: InductionSubmitState,
  formData: FormData,
): Promise<InductionSubmitState> {
  try {
    const phase = formData.get("phase")?.toString() ?? "answer";
    if (phase === "sign") {
      return await handleSign(templateId, workerId, nextUrl, formData);
    }
    return await handleAnswer(templateId, workerId, formData);
  } catch (e) {
    if (typeof e === "object" && e !== null && "digest" in e) throw e;
    console.error("[submitInduction] error:", e);
    return { error: "Something went wrong. Please try again." };
  }
}

async function handleAnswer(
  templateId: string,
  workerId: string,
  formData: FormData,
): Promise<InductionSubmitState> {
  const template = await prisma.inductionTemplate.findUnique({
    where: { id: templateId },
    include: { project: true },
  });
  if (!template) return { error: "Induction not found." };

  // Build combined question list: template questions + approved SWMS questions for worker's org
  const templateQuestions = template.questions as Question[];
  let swmsQuestions: Question[] = [];
  if (workerId && template.projectId) {
    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: { employingOrganisationId: true },
    });
    if (worker?.employingOrganisationId) {
      const swmsInductionQs = await prisma.swmsInductionQuestion.findMany({
        where: {
          projectId: template.projectId,
          organisationId: worker.employingOrganisationId,
          status: "approved",
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
      swmsQuestions = swmsInductionQs.map((q) => ({
        type: "short_answer" as const,
        question: q.question,
        expectedAnswerContext: q.expectedAnswerContext,
      }));
    }
  }

  const questions: Question[] = [...templateQuestions, ...swmsQuestions];
  const locked = parseLocked(formData, questions.length);

  // Score all questions — locked ones are auto-credited, remainder scored from FormData.
  // Also capture what the worker submitted for each non-locked question (for retry display).
  let correct = 0;
  const correctIndices: number[] = [];
  const previousSelections: Record<string, number[]> = {};
  for (let i = 0; i < questions.length; i++) {
    if (locked.includes(i)) {
      correct++;
      correctIndices.push(i);
    } else {
      const selected = formData.getAll(`q${i}`).map(Number);
      if (selected.length > 0) previousSelections[String(i)] = selected;
      if (scoreQuestion(questions[i], formData, i)) {
        correct++;
        correctIndices.push(i);
      }
    }
  }
  const total = questions.length;
  const score = total > 0 ? Math.round((correct / total) * 100) : 100;
  const passed = score === 100;

  // Anonymous preview — score but don't record attempts.
  // attemptsLeft intentionally omitted so client uses sessionStorage tracking.
  if (!workerId) {
    return { passed, score, total, correctIndices, previousSelections };
  }

  // Look up existing completion record
  let existing = await prisma.inductionCompletion.findUnique({
    where: { workerId_templateId: { workerId, templateId } },
  });

  // If a previous block has expired, reset attempts so worker gets a fresh 3
  if (existing?.blockedUntil && existing.blockedUntil <= new Date()) {
    existing = await prisma.inductionCompletion.update({
      where: { workerId_templateId: { workerId, templateId } },
      data: { attempts: 0, blockedUntil: null },
    });
  }

  // Reject if still within an active block
  if (existing?.blockedUntil && existing.blockedUntil > new Date()) {
    return { blocked: true, blockedUntil: existing.blockedUntil.toISOString() };
  }

  // Each submission = exactly 1 attempt
  const currentAttempts = (existing?.attempts ?? 0) + 1;

  if (!passed) {
    const isBlocked = currentAttempts >= MAX_ATTEMPTS;
    const blockedUntil = isBlocked ? new Date(Date.now() + BLOCK_DURATION_MS) : null;

    await prisma.inductionCompletion.upsert({
      where: { workerId_templateId: { workerId, templateId } },
      update: { attempts: currentAttempts, ...(blockedUntil ? { blockedUntil } : {}) },
      create: {
        workerId,
        templateId,
        score,
        passed: false,
        signedAt: new Date(),
        attempts: currentAttempts,
        ...(blockedUntil ? { blockedUntil } : {}),
      },
    });

    if (isBlocked) {
      sendBlockAlert(workerId, templateId, template, blockedUntil!).catch(console.error);
    }

    return {
      passed: false,
      score,
      total,
      // attemptsLeft is always an explicit number for authenticated workers
      attemptsLeft: MAX_ATTEMPTS - currentAttempts, // 2, 1, or 0
      blocked: isBlocked,
      blockedUntil: blockedUntil?.toISOString(),
      correctIndices,
      previousSelections,
    };
  }

  // Passed — prepare declaration preview (not recorded until handleSign)
  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    include: { project: true },
  });
  if (!worker) return { error: "Worker not found." };

  const workerName = `${worker.firstName} ${worker.lastName}`;
  const mobile = worker.mobile ?? "not provided";
  const projectName = worker.project.name;
  const declarationText = buildDeclarationText(workerName, projectName, mobile, new Date());

  return {
    passed: true,
    needsSignature: true,
    score,
    total,
    declarationPreview: {
      workerName,
      mobile,
      projectName,
      templateTitle: template.title,
      version: template.version,
      text: declarationText,
    },
  };
}

async function handleSign(
  templateId: string,
  workerId: string,
  nextUrl: string,
  formData: FormData,
): Promise<InductionSubmitState> {
  const confirmed = formData.get("confirmed") === "true";
  if (!confirmed) return { error: "You must agree to the declaration before signing." };

  const [template, worker] = await Promise.all([
    prisma.inductionTemplate.findUnique({
      where: { id: templateId },
      include: { project: true },
    }),
    prisma.worker.findUnique({
      where: { id: workerId },
      include: { project: true },
    }),
  ]);

  if (!template || !worker) return { error: "Record not found. Please restart the induction." };

  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    "unknown";

  const now = new Date();
  const workerName = `${worker.firstName} ${worker.lastName}`;
  const mobile = worker.mobile ?? "not provided";
  const projectName = worker.project.name;

  const declarationData = {
    workerName,
    mobile,
    timestamp: now.toISOString(),
    ipAddress: ip,
    inductionVersion: template.version,
    templateTitle: template.title,
    projectName,
    declarationText: buildDeclarationText(workerName, projectName, mobile, now),
  };

  await prisma.inductionCompletion.upsert({
    where: { workerId_templateId: { workerId, templateId } },
    update: {
      score: 100,
      passed: true,
      signedAt: now,
      declarationSignedAt: now,
      declarationIp: ip,
      declarationData,
      blockedUntil: null,
    },
    create: {
      workerId,
      templateId,
      score: 100,
      passed: true,
      signedAt: now,
      declarationSignedAt: now,
      declarationIp: ip,
      declarationData,
    },
  });

  if (nextUrl) redirect(nextUrl);
  return { passed: true, score: 100, total: (template.questions as Question[]).length };
}

async function sendBlockAlert(
  workerId: string,
  templateId: string,
  template: { title: string },
  blockedUntil: Date,
) {
  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    include: {
      project: true,
      employingOrganisation: {
        include: { users: { where: { role: "subcontractor_admin" } } },
      },
    },
  });
  if (!worker?.employingOrganisation?.users.length) return;

  const workerName = `${worker.firstName} ${worker.lastName}`;
  for (const admin of worker.employingOrganisation.users) {
    await sendInductionBlockedAlert({
      to: admin.email,
      adminName: admin.name ?? admin.email,
      workerName,
      companyName: worker.employingOrganisation.name,
      inductionTitle: template.title,
      projectName: worker.project.name,
      blockedUntil,
    });
  }
}
