import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { SwmsQuestionReviewList } from "./swms-question-review-list";
import { reviewSwmsQuestion } from "./actions";
import { SwmsQuestionStatus } from "@/generated/prisma/client";

export default async function SwmsQuestionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const appUser = await requireRole(AGERO_ROLES);

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      swmsInductionQuestions: {
        include: { organisation: true },
        orderBy: [{ organisationId: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!project || project.organisationId !== appUser.organisationId) notFound();

  // Group questions by organisation
  const byOrg = new Map<string, { orgName: string; questions: typeof project.swmsInductionQuestions }>();
  for (const q of project.swmsInductionQuestions) {
    const key = q.organisationId;
    if (!byOrg.has(key)) {
      byOrg.set(key, { orgName: q.organisation.name, questions: [] });
    }
    byOrg.get(key)!.questions.push(q);
  }

  const pendingCount = project.swmsInductionQuestions.filter(
    (q) => q.status === SwmsQuestionStatus.pending_review,
  ).length;

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/projects" userRole={appUser.role} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link
          href={`/projects/${id}/induction`}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          ← Site induction overview
        </Link>
        <div className="mt-2">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            SWMS induction questions
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {project.name} · AI-generated questions from subcontractor SWMS documents
          </p>
        </div>

        {pendingCount > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            {pendingCount} question{pendingCount !== 1 ? "s" : ""} pending review
          </div>
        )}

        {project.swmsInductionQuestions.length === 0 ? (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No SWMS induction questions yet. They are generated automatically when a subcontractor
              uploads an approved SWMS.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {Array.from(byOrg.entries()).map(([orgId, { orgName, questions }]) => (
              <div
                key={orgId}
                className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
                  <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    {orgName}
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {questions.filter((q) => q.status === SwmsQuestionStatus.approved).length} approved ·{" "}
                    {questions.filter((q) => q.status === SwmsQuestionStatus.pending_review).length} pending ·{" "}
                    {questions.filter((q) => q.status === SwmsQuestionStatus.rejected).length} rejected
                  </p>
                </div>
                <SwmsQuestionReviewList
                  projectId={id}
                  questions={questions.map((q) => ({
                    id: q.id,
                    question: q.question,
                    expectedAnswerContext: q.expectedAnswerContext,
                    status: q.status,
                  }))}
                  reviewAction={reviewSwmsQuestion.bind(null, id)}
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
