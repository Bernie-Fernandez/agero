export const dynamic = "force-dynamic";
export const revalidate = 0;

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { InductionForm } from "./induction-form";
import { submitInduction } from "./actions";

type StoredQuestion = {
  question: string;
  type?: "multiple_choice" | "short_answer";
  options?: string[];
  correctAnswers?: number[];
  correctAnswer?: number;
  isRisk?: boolean;
  riskAddedAt?: string;
};

function toEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/embed/")) return url;
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (u.hostname === "youtu.be") {
      const v = u.pathname.slice(1);
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (u.hostname.includes("vimeo.com") && !u.hostname.includes("player")) {
      const id = u.pathname.slice(1).split("/")[0];
      if (/^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
    if (u.hostname === "player.vimeo.com") return url;
    return null;
  } catch {
    return null;
  }
}

export default async function PublicInductionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ worker?: string; next?: string }>;
}) {
  const { id } = await params;
  const { worker: workerId, next: nextUrl } = await searchParams;

  const template = await prisma.inductionTemplate.findUnique({
    where: { id },
    include: { project: true },
  });
  if (!template) notFound();

  const templateQuestions = template.questions as StoredQuestion[];
  const embedUrl = toEmbedUrl(template.videoUrl);

  let workerName: string | null = null;
  let swmsGated = false; // worker's org has no approved SWMS for this project
  let initialLockedCorrect: number[] = [];
  let isReInduction = false;
  let swmsQuestions: StoredQuestion[] = [];

  if (workerId) {
    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      include: { employingOrganisation: true },
    });

    if (worker) {
      workerName = `${worker.firstName} ${worker.lastName}`;

      // ── SWMS gate: only applies to site-specific inductions ────────────────
      if (template.type === "site_specific" && template.projectId && worker.employingOrganisationId) {
        const approvedSwms = await prisma.swmsSubmission.findFirst({
          where: {
            projectId: template.projectId,
            organisationId: worker.employingOrganisationId,
            status: "approved",
          },
        });
        if (!approvedSwms) swmsGated = true;
      }

      // ── Layer 3: SWMS-derived questions for worker's org ───────────────────
      if (!swmsGated && worker.employingOrganisationId && template.projectId) {
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
        }));
      }

      // ── Re-induction: worker has a prior passing completion on an older template ─
      // Find the most recent passed completion for a site-specific template on this project
      const priorCompletion = await prisma.inductionCompletion.findFirst({
        where: {
          workerId,
          passed: true,
          template: {
            projectId: template.projectId,
            type: "site_specific",
          },
        },
        orderBy: { signedAt: "desc" },
      });

      if (priorCompletion && priorCompletion.templateId !== id) {
        // Worker passed an older version — only show new risk questions
        isReInduction = true;
        const priorSignedAt = priorCompletion.signedAt;
        // Lock all questions that are NOT new risk questions (riskAddedAt > priorSignedAt)
        initialLockedCorrect = templateQuestions
          .map((q, i) => ({ q, i }))
          .filter(({ q }) => {
            if (!q.isRisk) return true; // standard question — always lock
            if (!q.riskAddedAt) return true; // risk question without date — lock
            return new Date(q.riskAddedAt) <= priorSignedAt; // old risk — lock
          })
          .map(({ i }) => i);
      }
    }
  }

  // Combined question list shown to the worker (template + SWMS layer 3)
  const allQuestions = [...templateQuestions, ...swmsQuestions];

  // Extend initialLockedCorrect for SWMS questions: if re-induction, auto-credit all SWMS
  // questions (they were not part of the previous induction so we don't require them again
  // on re-induction — only new risk questions are mandatory).
  // Actually for re-induction we do NOT lock SWMS questions — they must always be answered.
  // initialLockedCorrect already only contains template indices so this is correct as-is.

  // Check completion status (uses current templateId — SWMS questions are not per-template)
  let alreadyComplete = false;
  let isBlocked = false;
  let blockedUntilStr: string | null = null;

  if (workerId) {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    const existing = await prisma.inductionCompletion.findUnique({
      where: { workerId_templateId: { workerId, templateId: id } },
    });
    console.log("[induction page] block check", {
      workerId,
      templateId: id,
      existing: existing
        ? {
            id: existing.id,
            passed: existing.passed,
            attempts: existing.attempts,
            blockedUntil: existing.blockedUntil,
            signedAt: existing.signedAt,
          }
        : null,
      now: new Date(),
    });
    if (existing) {
      if (existing.blockedUntil && existing.blockedUntil > new Date()) {
        isBlocked = true;
        blockedUntilStr = existing.blockedUntil.toLocaleString("en-AU", {
          dateStyle: "medium",
          timeStyle: "short",
        });
      } else if (existing.passed && existing.signedAt > twelveMonthsAgo) {
        alreadyComplete = true;
      }
    }
  }

  const submitAction = submitInduction.bind(null, id, workerId ?? "", nextUrl ?? "");

  // How many "new" questions the worker must answer in a re-induction
  const newQuestionCount = allQuestions.length - initialLockedCorrect.length;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Agero Safety
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {template.title}
        </h1>
        {template.type === "generic" && (
          <p className="mt-1 text-sm text-zinc-500">
            General site safety induction — valid across all projects
          </p>
        )}
        {workerName && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Completing for: <span className="font-medium">{workerName}</span>
          </p>
        )}

        {/* SWMS gate */}
        {swmsGated ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-lg font-semibold text-amber-800 dark:text-amber-300">
              SWMS approval required
            </p>
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
              Your company&apos;s Safe Work Method Statement for this project has not yet been
              approved. Please ask your supervisor or company administrator to submit and get the
              SWMS approved before completing this induction.
            </p>
          </div>
        ) : isBlocked ? (
          /* Blocked */
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/30">
            <p className="text-xl font-bold text-red-700 dark:text-red-300">
              Site access blocked for 24 hours
            </p>
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              You have used all 3 attempts. Your employer has been notified.
            </p>
            <p className="mt-3 text-sm font-medium text-red-700 dark:text-red-300">
              You may retry from:{" "}
              <span className="font-semibold">{blockedUntilStr}</span>
            </p>
            <Link
              href={`/inductions/${id}${workerId ? `?worker=${workerId}` : ""}${nextUrl ? `${workerId ? "&" : "?"}next=${encodeURIComponent(nextUrl)}` : ""}`}
              className="mt-4 inline-block text-xs text-red-600 underline dark:text-red-400"
            >
              Reload page to check if block has been lifted
            </Link>
          </div>
        ) : alreadyComplete ? (
          /* Already completed */
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-950/30">
            <p className="text-lg font-semibold text-green-700 dark:text-green-300">
              ✓ Induction already completed
            </p>
            <p className="mt-2 text-sm text-green-600 dark:text-green-400">
              You have a valid, current completion for this induction.
            </p>
            {nextUrl && (
              <Link
                href={nextUrl}
                className="mt-4 inline-block rounded-lg bg-green-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-800"
              >
                Continue to site sign-in →
              </Link>
            )}
          </div>
        ) : (
          /* Questions + declaration flow */
          <>
            {isReInduction ? (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950/30">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  Re-induction required
                </p>
                <p className="mt-1 text-sm text-blue-700 dark:text-blue-400">
                  Site conditions have changed since your last induction. You need to answer{" "}
                  {newQuestionCount} new question{newQuestionCount !== 1 ? "s" : ""}.
                  Your previous answers have been credited.
                </p>
              </div>
            ) : (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {allQuestions.length} question{allQuestions.length !== 1 ? "s" : ""} · Pass mark:
                100% · 3 attempts allowed
              </p>
            )}

            {embedUrl && (
              <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div className="relative pb-[56.25%]">
                  <iframe
                    src={embedUrl}
                    className="absolute inset-0 h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Safety induction video"
                  />
                </div>
              </div>
            )}

            {embedUrl && allQuestions.length > 0 && (
              <p className="mt-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Watch the video above, then answer the questions below.
              </p>
            )}

            <div className="mt-6">
              <InductionForm
                questions={allQuestions}
                submitAction={submitAction}
                initialLockedCorrect={initialLockedCorrect.length > 0 ? initialLockedCorrect : undefined}
                isReInduction={isReInduction}
                projectName={template.project?.name ?? "this site"}
                templateTitle={template.title}
                showChat={!swmsGated && !isBlocked && !alreadyComplete && !!process.env.ANTHROPIC_API_KEY}
                workerId={workerId}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
