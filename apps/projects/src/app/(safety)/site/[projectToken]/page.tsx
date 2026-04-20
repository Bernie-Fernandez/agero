import { notFound } from "next/navigation";
import { prisma } from "@/lib/safety/prisma";
import { getWorkerSession } from "@/lib/safety/worker-auth";
import { SiteAuthGate } from "./site-auth-gate";
import { ConfirmSignInForm } from "./confirm-sign-in-form";
import { siteSignIn } from "./actions";
import { siteAuthAction } from "./site-auth-actions";

export default async function SiteSignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectToken: string }>;
  searchParams: Promise<{ worker?: string }>;
}) {
  const { projectToken } = await params;
  const { worker: workerIdParam } = await searchParams;

  const project = await prisma.project.findUnique({
    where: { token: projectToken },
    include: {
      inductionTemplates: { where: { isActive: true }, orderBy: { type: "asc" } },
    },
  });

  if (!project) notFound();

  const globalGeneric = await prisma.inductionTemplate.findFirst({
    where: { type: "generic", isActive: true },
    select: { id: true, title: true },
  });

  const inductionRequirements: { id: string; title: string; type: string }[] = [];
  if (globalGeneric) {
    inductionRequirements.push({ id: globalGeneric.id, title: globalGeneric.title, type: "generic" });
  }
  const siteTemplate = project.inductionTemplates.find((t) => t.type === "site_specific");
  if (siteTemplate) {
    inductionRequirements.push({ id: siteTemplate.id, title: siteTemplate.title, type: "site_specific" });
  }

  // Pre-fill from ?worker= (returning after completing induction)
  let workerPrefill: { id: string; firstName: string; lastName: string } | null = null;
  if (workerIdParam) {
    const w = await prisma.worker.findUnique({
      where: { id: workerIdParam },
      select: { id: true, firstName: true, lastName: true, projectId: true },
    });
    if (w && w.projectId === project.id) {
      workerPrefill = { id: w.id, firstName: w.firstName, lastName: w.lastName };
    }
  }

  // Check for active worker session
  const session = await getWorkerSession();

  // If authenticated, check which inductions the worker has already passed
  const inductionStatus: Record<string, boolean> = {};
  if (session && inductionRequirements.length > 0) {
    const workerRecord = await prisma.worker.findFirst({
      where: { mobile: session.workerAccount.mobile, projectId: project.id },
      select: {
        inductionCompletions: {
          select: { templateId: true, passed: true, signedAt: true },
        },
      },
    });
    if (workerRecord) {
      const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      for (const req of inductionRequirements) {
        inductionStatus[req.id] = workerRecord.inductionCompletions.some(
          (c) => c.templateId === req.id && c.passed && c.signedAt > cutoff,
        );
      }
    }
  }

  const allComplete =
    inductionRequirements.length > 0 &&
    inductionRequirements.every((r) => inductionStatus[r.id]);
  const anyRequired =
    inductionRequirements.length > 0 &&
    inductionRequirements.some((r) => !inductionStatus[r.id]);

  const signInAction = siteSignIn.bind(null, projectToken);
  const boundSiteAuth = siteAuthAction.bind(null, projectToken);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Agero Safety</span>
          <span className="text-xs text-zinc-500">Site sign-in</span>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{project.name}</h1>
        {project.address && (
          <p className="mt-1 text-sm text-zinc-500">{project.address}</p>
        )}

        {inductionRequirements.length > 0 && (
          <div
            className={`mt-4 rounded-xl border px-4 py-3 ${
              allComplete
                ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
            }`}
          >
            <p
              className={`text-sm font-medium ${
                allComplete
                  ? "text-green-800 dark:text-green-300"
                  : "text-amber-800 dark:text-amber-300"
              }`}
            >
              {allComplete ? "Inductions complete" : "Safety inductions required before sign-in"}
            </p>
            <ul className="mt-1.5 space-y-1">
              {inductionRequirements.map((req) => {
                const done = inductionStatus[req.id] ?? false;
                return (
                  <li
                    key={req.id}
                    className={`flex items-center gap-1.5 text-sm ${
                      done
                        ? "text-green-700 dark:text-green-400"
                        : "text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    <span>{done ? "✓" : "•"}</span>
                    {req.title}
                    {!done && (
                      <span
                        className={`text-xs ${
                          done ? "text-green-500" : "text-amber-500"
                        }`}
                      >
                        ({req.type === "generic" ? "once per year" : "site-specific"})
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mt-6">
          {/* If returning from an induction (workerPrefill) OR has a session: show confirm form */}
          {(workerPrefill || session) ? (
            <ConfirmSignInForm
              signInAction={signInAction}
              workerPrefill={workerPrefill}
              session={
                session
                  ? {
                      mobile: session.workerAccount.mobile,
                      firstName: session.workerAccount.firstName,
                      lastName: session.workerAccount.lastName,
                    }
                  : null
              }
              projectToken={projectToken}
            />
          ) : (
            <SiteAuthGate siteAuthAction={boundSiteAuth} signInAction={signInAction} />
          )}
        </div>
      </main>
    </div>
  );
}
