import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { createDilapidationReport } from "./actions";
import { DilapidationForm } from "./dilapidation-form";

export default async function DilapidationPage({
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
    select: {
      id: true,
      name: true,
      address: true,
      organisationId: true,
      floorPlan: { select: { fileUrl: true } },
    },
  });
  if (!safetyProject || safetyProject.organisationId !== user.organisationId) notFound();

  if (showNew === "1") {
    // Get Agero admin/manager users for default email recipients
    const adminUsers = await prisma.user.findMany({
      where: {
        organisationId: user.organisationId,
        role: { in: ["admin", "safety_manager", "project_manager"] },
      },
      select: { email: true },
    });

    return (
      <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
        <AppNav currentPath="/projects" userRole={user.role} />
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <Link
            href={`/projects/${id}/dilapidation`}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            ← Dilapidation Reports
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            New Dilapidation Survey
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{safetyProject.name}</p>
          <div className="mt-8">
            <DilapidationForm
              submitAction={createDilapidationReport.bind(null, id)}
              floorPlanUrl={safetyProject.floorPlan?.fileUrl ?? null}
              defaultRecipients={adminUsers.map((u) => u.email)}
            />
          </div>
        </main>
      </div>
    );
  }

  const reports = await prisma.dilapidationReport.findMany({
    where: { projectId: id },
    include: { conductedBy: { select: { name: true, email: true } } },
    orderBy: { conductedAt: "desc" },
  });

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
              Dilapidation Reports
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {safetyProject.name}
              {safetyProject.address && ` · ${safetyProject.address}`}
            </p>
          </div>
          <Link
            href={`/projects/${id}/dilapidation?new=1`}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + New survey
          </Link>
        </div>

        {!safetyProject.floorPlan && (
          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            No floor plan uploaded. Upload a floor plan in{" "}
            <Link href={`/projects/${id}/site-prep`} className="text-blue-600 hover:underline dark:text-blue-400">
              Site Preparation
            </Link>{" "}
            to enable pin-drop surveying.
          </div>
        )}

        {reports.length === 0 ? (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">No dilapidation reports on this project.</p>
            <p className="mt-1 text-xs text-zinc-400">
              Conduct a dilapidation survey before works begin to document existing conditions.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {reports.map((r) => {
              const pins = r.pins as { pinNumber: number; description: string; condition: string }[];
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {r.conductedAt.toLocaleDateString("en-AU", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        timeZone: "Australia/Melbourne",
                      })}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {r.conductedBy.name ?? r.conductedBy.email} · {pins.length} item{pins.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {r.reportUrl && (
                      <a
                        href={r.reportUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        PDF →
                      </a>
                    )}
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                      Submitted
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
