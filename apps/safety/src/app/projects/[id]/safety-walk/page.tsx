import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { createSafetyWalk } from "./actions";
import { SafetyWalkForm } from "./safety-walk-form";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default async function SafetyWalkPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const { new: showNew } = await searchParams;
  const user = await requireRole(AGERO_ROLES);

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id },
    select: { id: true, name: true, address: true, organisationId: true },
  });
  if (!safetyProject || safetyProject.organisationId !== user.organisationId) notFound();

  if (showNew === "1") {
    const projectUsers = await prisma.user.findMany({
      where: { organisationId: user.organisationId },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });

    return (
      <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
        <AppNav currentPath="/projects" userRole={user.role} />
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <Link
            href={`/projects/${id}/safety-walk`}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            ← Site Safety Walks
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            New Site Safety Walk
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{safetyProject.name}</p>
          <div className="mt-8">
            <SafetyWalkForm
              submitAction={createSafetyWalk.bind(null, id)}
              projectUsers={projectUsers}
            />
          </div>
        </main>
      </div>
    );
  }

  const walks = await prisma.siteSafetyWalk.findMany({
    where: { projectId: id },
    include: { conductedBy: { select: { name: true, email: true } } },
    orderBy: { conductedAt: "desc" },
  });

  const now = new Date();
  const lastWalk = walks[0];
  const overdueAlert = !lastWalk || (now.getTime() - lastWalk.conductedAt.getTime()) > SEVEN_DAYS_MS;

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/projects" userRole={user.role} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link
          href={`/projects/${id}/readiness`}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          ← {safetyProject.name}
        </Link>

        <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Site Safety Walks
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {safetyProject.name}
              {safetyProject.address && ` · ${safetyProject.address}`}
            </p>
          </div>
          <Link
            href={`/projects/${id}/safety-walk?new=1`}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + Conduct walk
          </Link>
        </div>

        {overdueAlert && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-950/20">
            <span className="text-amber-600 dark:text-amber-400 mt-0.5">⚠</span>
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Safety walk overdue
              </p>
              <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                {lastWalk
                  ? `Last walk was ${Math.floor((now.getTime() - lastWalk.conductedAt.getTime()) / (1000 * 60 * 60 * 24))} days ago.`
                  : "No safety walks have been conducted on this project."}
                {" "}Site safety walks should be conducted at least weekly.
              </p>
            </div>
          </div>
        )}

        {walks.length === 0 ? (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">No safety walks recorded yet.</p>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {walks.map((w) => {
              const items = w.items as { answer: string }[];
              const noCount = items.filter((i) => i.answer === "NO").length;
              const yesCount = items.filter((i) => i.answer === "YES").length;
              return (
                <div
                  key={w.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {w.conductedAt.toLocaleDateString("en-AU", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        timeZone: "Australia/Melbourne",
                      })}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {w.conductedBy.name ?? w.conductedBy.email} · {yesCount} compliant
                      {noCount > 0 && ` · ${noCount} issue${noCount !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {w.reportUrl && (
                      <a
                        href={w.reportUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        PDF →
                      </a>
                    )}
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        noCount > 0
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                          : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                      }`}
                    >
                      {noCount > 0 ? `${noCount} issue${noCount !== 1 ? "s" : ""}` : "All clear"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
