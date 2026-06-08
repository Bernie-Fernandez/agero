import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { SitePrepForm } from "./site-prep-form";
import { submitSitePrepChecklist } from "./actions";
import { SitePrepPlanForm } from "./site-prep-plan-form";
import { submitSitePrepPlan } from "./site-prep-plan-actions";
import { FloorPlanForm } from "./floor-plan-form";
import { uploadFloorPlan } from "./floor-plan-actions";

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
      floorPlan: true,
      preStartAssessments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true },
      },
      sitePreparationPlan: {
        select: {
          status: true,
          signOffName: true,
          signOffAt: true,
          sections: true,
          pins: { select: { categoryId: true, pinX: true, pinY: true } },
        },
      },
      sitePreparationChecklists: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          managerSignOffName: true,
          managerSignOffAt: true,
          pdfUrl: true,
          items: true,
        },
      },
    },
  });
  if (!safetyProject) notFound();

  const preStart = safetyProject.preStartAssessments[0] ?? null;
  const plan = safetyProject.sitePreparationPlan;
  const existing = safetyProject.sitePreparationChecklists[0] ?? null;
  const floorPlan = safetyProject.floorPlan;
  const floorPlanUploadAction = uploadFloorPlan.bind(null, id);

  const isLocked = !preStart;
  const phase1Complete = plan?.status === "COMPLETE";
  const phase2Complete = !!existing;

  const projectUsers = await prisma.user.findMany({
    where: {
      organisationId: user.organisationId,
      role: { in: ["admin", "safety_manager", "project_manager", "site_manager"] },
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  const planSubmitAction = submitSitePrepPlan.bind(null, id);
  const checklistSubmitAction = submitSitePrepChecklist.bind(null, id);

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
            Site Preparation
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

        {/* Phase 2 done banner */}
        {done === "1" && (
          <div className="mt-8 rounded-xl border-2 border-green-300 bg-green-50 p-8 text-center dark:border-green-700 dark:bg-green-950/40">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/60">
              <svg className="h-7 w-7 text-green-700 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-xl font-bold text-green-800 dark:text-green-300">
              Site Preparation Checklist submitted and signed.
            </p>
            <p className="mt-2 text-sm text-green-700 dark:text-green-400">
              A PDF has been generated and emailed to the Director and Safety Manager.
            </p>
            <Link
              href={`/projects/${id}/readiness`}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-8 py-4 text-base font-bold text-white shadow-md hover:bg-green-800 sm:w-auto dark:bg-green-600 dark:hover:bg-green-500"
            >
              Return to Readiness Dashboard →
            </Link>
          </div>
        )}

        {/* ── Floor plan ────────────────────────────────────────────────────── */}
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Floor Plan
          </h2>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="mb-3 text-xs text-zinc-500">
              Upload a site floor plan (PDF, image). Shared across Site Preparation, Dilapidation, and Defects.
            </p>
            <FloorPlanForm
              uploadAction={floorPlanUploadAction}
              existingFileUrl={floorPlan?.fileUrl}
              existingFileName={floorPlan?.fileName}
              uploadedBy={floorPlan?.uploadedBy}
              uploadedAt={floorPlan?.uploadedAt}
            />
          </div>
        </section>

        {/* Locked: no pre-start */}
        {isLocked && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-700/40 dark:bg-amber-950/20">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Pre-Start Risk Assessment required
            </p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
              The Site Preparation Plan is locked until the Pre-Start Risk Assessment has been
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

        {/* ── Phase 1: Planning ─────────────────────────────────────────────── */}
        {!isLocked && (
          <div className="mt-8">
            <div className="mb-4 flex items-center gap-3">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  phase1Complete
                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                }`}
              >
                Phase 1
              </span>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Site Preparation Plan
              </h2>
              {phase1Complete && (
                <span className="ml-auto rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  Complete
                </span>
              )}
            </div>

            {phase1Complete ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  Plan signed off
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {plan!.signOffName} ·{" "}
                  {plan!.signOffAt &&
                    new Date(plan!.signOffAt).toLocaleString("en-AU", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                </p>
                <p className="mt-3 text-xs text-zinc-500">
                  {(plan!.sections as unknown[]).length} categories planned. Phase 2 execution
                  checklist is now available below.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
                  <p className="text-sm text-zinc-500">
                    Document the planned location and setup for each of the 10 required categories
                    before mobilisation. Signing this plan locks Phase 1 and makes the Phase 2
                    execution checklist available on the day of site establishment.
                  </p>
                </div>
                <div className="p-5">
                  <SitePrepPlanForm
                    submitAction={planSubmitAction}
                    projectUsers={projectUsers}
                    floorPlanUrl={floorPlan?.fileUrl}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Phase 2: Execution ────────────────────────────────────────────── */}
        {!isLocked && done !== "1" && (
          <div className="mt-8">
            <div className="mb-4 flex items-center gap-3">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  phase2Complete
                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                    : phase1Complete
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                      : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
                }`}
              >
                Phase 2
              </span>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Site Preparation Checklist
              </h2>
              {phase2Complete && (
                <span className="ml-auto rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  Complete
                </span>
              )}
            </div>

            {!phase1Complete ? (
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
                <p className="text-sm text-zinc-400 dark:text-zinc-500">
                  Phase 2 becomes available after Phase 1 planning has been signed off.
                </p>
              </div>
            ) : (
              <>
                {phase2Complete && (
                  <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                          Checklist signed
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {existing!.managerSignOffName} ·{" "}
                          {new Date(existing!.managerSignOffAt).toLocaleString("en-AU", {
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
                    {(() => {
                      const resultItems = existing!.items as Array<{ answer: string }>;
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
                    {existing!.pdfUrl && (
                      <a
                        href={existing!.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline dark:text-blue-400"
                      >
                        View PDF →
                      </a>
                    )}
                  </div>
                )}

                {phase2Complete ? (
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
                        <SitePrepForm
                          safetyProjectId={id}
                          submitAction={checklistSubmitAction}
                          projectUsers={projectUsers}
                          planSections={plan?.sections as Array<{ sectionId: string; sectionName: string; planNote: string; plannedCompletionDate: string }> | undefined}
                          planPins={plan?.pins?.map((p) => ({ categoryIndex: p.categoryId, x: p.pinX, y: p.pinY }))}
                          floorPlanUrl={floorPlan?.fileUrl}
                        />
                      </div>
                    </details>
                  </div>
                ) : (
                  <SitePrepForm
                    safetyProjectId={id}
                    submitAction={checklistSubmitAction}
                    projectUsers={projectUsers}
                    planSections={plan?.sections as Array<{ sectionId: string; sectionName: string; planNote: string; plannedCompletionDate: string }> | undefined}
                    planPins={plan?.pins?.map((p) => ({ categoryIndex: p.categoryId, x: p.pinX, y: p.pinY }))}
                    floorPlanUrl={floorPlan?.fileUrl}
                  />
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
