import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/safety/prisma";
import { AppNav } from "@/components/safety/safety-nav";
import { requireRole, AGERO_ROLES } from "@/lib/safety/auth";
import { SwmsUploadForm } from "./swms-upload-form";
import { uploadSwms } from "./actions";
import { DocumentType, SwmsQuestionStatus } from "@/generated/safety-prisma/client";

export default async function SiteInductionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const appUser = await requireRole(AGERO_ROLES);

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      inductionTemplates: {
        where: { type: "site_specific" },
        orderBy: { version: "desc" },
      },
      documents: { where: { type: DocumentType.swms } },
    },
  });

  if (!project || project.organisationId !== appUser.organisationId) notFound();

  const activeTemplate = project.inductionTemplates.find((t) => t.isActive);
  const swms = project.documents[0];
  const swmsAction = uploadSwms.bind(null, id);

  // Completion stats for the active template
  const completionCount = activeTemplate
    ? await prisma.inductionCompletion.count({
        where: { templateId: activeTemplate.id, passed: true },
      })
    : 0;

  const recentCompletions = activeTemplate
    ? await prisma.inductionCompletion.findMany({
        where: { templateId: activeTemplate.id, passed: true },
        include: { worker: true },
        orderBy: { signedAt: "desc" },
        take: 10,
      })
    : [];

  // Workers who need re-induction: passed an older template version but not the active one
  let reInductionCount = 0;
  if (activeTemplate) {
    const olderTemplates = project.inductionTemplates.filter(
      (t) => !t.isActive && t.type === "site_specific",
    );
    if (olderTemplates.length > 0) {
      const olderIds = olderTemplates.map((t) => t.id);
      const workersPriorPassed = await prisma.inductionCompletion.findMany({
        where: { templateId: { in: olderIds }, passed: true },
        select: { workerId: true },
        distinct: ["workerId"],
      });
      const priorWorkerIds = workersPriorPassed.map((c) => c.workerId);
      if (priorWorkerIds.length > 0) {
        const alreadyDoneNew = await prisma.inductionCompletion.findMany({
          where: {
            templateId: activeTemplate.id,
            workerId: { in: priorWorkerIds },
            passed: true,
          },
          select: { workerId: true },
        });
        const doneSet = new Set(alreadyDoneNew.map((c) => c.workerId));
        reInductionCount = priorWorkerIds.filter((wId) => !doneSet.has(wId)).length;
      }
    }
  }

  // Pending SWMS induction questions
  const pendingSwmsQuestionsCount = await prisma.swmsInductionQuestion.count({
    where: { projectId: id, status: SwmsQuestionStatus.pending_review },
  });

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/projects" userRole={appUser.role} />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link href={`/projects/${id}`} className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← {project.name}
        </Link>
        <div className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Site induction — {project.name}
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Workers must complete this induction before signing in to this site.
            </p>
          </div>
          <Link
            href={`/projects/${id}/induction/builder`}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {activeTemplate ? "Edit questionnaire" : "Build questionnaire"}
          </Link>
        </div>

        {/* Alerts row */}
        {(reInductionCount > 0 || pendingSwmsQuestionsCount > 0) && (
          <div className="mt-4 flex flex-wrap gap-3">
            {reInductionCount > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                {reInductionCount} worker{reInductionCount !== 1 ? "s" : ""} need re-induction — site conditions have changed
              </div>
            )}
            {pendingSwmsQuestionsCount > 0 && (
              <Link
                href={`/projects/${id}/induction/swms-questions`}
                className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50"
              >
                {pendingSwmsQuestionsCount} SWMS question{pendingSwmsQuestionsCount !== 1 ? "s" : ""} pending review →
              </Link>
            )}
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Questionnaire status */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Questionnaire</h2>
            {activeTemplate ? (
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Version</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">v{activeTemplate.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Questions</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    {(activeTemplate.questions as unknown[]).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Pass mark</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">100%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Video</span>
                  <span className={`font-medium ${activeTemplate.videoUrl ? "text-green-600 dark:text-green-400" : "text-zinc-400"}`}>
                    {activeTemplate.videoUrl ? "Linked" : "None"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Workers passed</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">{completionCount}</span>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-sm text-amber-600 dark:text-amber-400">No questionnaire built yet.</p>
                <Link
                  href={`/projects/${id}/induction/builder`}
                  className="mt-2 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  Build questionnaire →
                </Link>
              </div>
            )}
          </div>

          {/* SWMS */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                SWMS — Safe Work Method Statement
              </h2>
              <Link
                href={`/projects/${id}/induction/swms-questions`}
                className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Induction questions →
              </Link>
            </div>
            <SwmsUploadForm uploadAction={swmsAction} currentUrl={swms?.url} />
          </div>
        </div>

        {/* Version history */}
        {project.inductionTemplates.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Version history</h2>
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Version</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Questions</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Pass mark</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Created</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {project.inductionTemplates.map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">v{t.version}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {(t.questions as unknown[]).length}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">100%</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {new Date(t.createdAt).toLocaleDateString("en-AU")}
                      </td>
                      <td className="px-4 py-3">
                        {t.isActive ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                            Active
                          </span>
                        ) : (
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
                            Superseded
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent completions */}
        {recentCompletions.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
              Recent completions (current version)
            </h2>
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Worker</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Score</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {recentCompletions.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                        {c.worker.firstName} {c.worker.lastName}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{c.score}%</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {new Date(c.signedAt).toLocaleDateString("en-AU")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
