import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { SitePrepForm } from "./site-prep-form";
import { submitSitePrepChecklist } from "./actions";

export default async function SitePrepPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { id } = await params;
  const { done } = await searchParams;
  const user = await requireRole(AGERO_ROLES);

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id },
    include: {
      preStartAssessments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, signOffName: true, signOffAt: true },
      },
      sitePreparationChecklists: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, managerSignOffName: true, managerSignOffAt: true, pdfUrl: true, items: true },
      },
    },
  });
  if (!safetyProject) notFound();

  const preStart = safetyProject.preStartAssessments[0] ?? null;
  const existing = safetyProject.sitePreparationChecklists[0] ?? null;
  const isLocked = !preStart;
  const isComplete = !!existing;

  const submitAction = submitSitePrepChecklist.bind(null, id);

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/projects" userRole={user.role} />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {/* Breadcrumb */}
        <Link
          href={`/projects/${id}/readiness`}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          ← {safetyProject.name}
        </Link>

        <div className="mt-2">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Site Preparation Checklist
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {safetyProject.name}
            {safetyProject.address && ` · ${safetyProject.address}`}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
              52 items · 10 categories
            </span>
            <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
              VIC OHS Regulations 2017
            </span>
          </div>
        </div>

        {/* Done banner */}
        {done === "1" && (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
            Checklist submitted and signed. A PDF has been generated and emailed to the Director and
            Safety Manager.
          </div>
        )}

        {/* Locked state */}
        {isLocked && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-700/40 dark:bg-amber-950/20">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Pre-Start Risk Assessment required
            </p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
              The Site Preparation Checklist is locked until the Pre-Start Risk Assessment has been
              signed for this project.
            </p>
            <Link
              href={`/projects/${id}/pre-start`}
              className="mt-3 inline-block rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500"
            >
              Complete Pre-Start Assessment →
            </Link>
          </div>
        )}

        {/* Existing checklist summary */}
        {isComplete && (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  Checklist signed
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {existing.managerSignOffName} ·{" "}
                  {new Date(existing.managerSignOffAt).toLocaleString("en-AU", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                Complete
              </span>
            </div>

            {/* Item summary badges */}
            {(() => {
              const resultItems = existing.items as Array<{ answer: string }>;
              const yes = resultItems.filter((i) => i.answer === "YES").length;
              const no = resultItems.filter((i) => i.answer === "NO").length;
              return (
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  <span className="rounded-full bg-green-100 px-2.5 py-0.5 font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                    {yes} YES
                  </span>
                  {no > 0 && (
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                      {no} NO — corrective action required
                    </span>
                  )}
                </div>
              );
            })()}

            {existing.pdfUrl && (
              <a
                href={existing.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                View PDF →
              </a>
            )}
          </div>
        )}

        {/* Form */}
        {!isLocked && (
          <div className="mt-8">
            {isComplete && done !== "1" ? (
              <div>
                <p className="text-sm text-zinc-500">
                  A signed checklist already exists for this project. Complete a new inspection
                  below if site conditions have changed.
                </p>
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    New inspection ↓
                  </summary>
                  <div className="mt-6">
                    <SitePrepForm safetyProjectId={id} submitAction={submitAction} />
                  </div>
                </details>
              </div>
            ) : (
              !isComplete && <SitePrepForm safetyProjectId={id} submitAction={submitAction} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
