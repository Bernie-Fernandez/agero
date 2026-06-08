import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { createIncidentReport } from "./actions";
import { IncidentForm } from "./incident-form";

const TYPE_LABELS: Record<string, string> = {
  INJURY: "Injury",
  NEAR_MISS: "Near Miss",
  PROPERTY_DAMAGE: "Property Damage",
  ENVIRONMENTAL: "Environmental",
  PSYCHOLOGICAL: "Psychological",
  OTHER: "Other",
};

export default async function IncidentPage({
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

  const incidents = await prisma.incidentReport.findMany({
    where: { projectId: id },
    include: { reportedBy: { select: { name: true, email: true } } },
    orderBy: { incidentAt: "desc" },
  });

  if (showNew === "1") {
    return (
      <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
        <AppNav currentPath="/projects" userRole={user.role} />
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <Link
            href={`/projects/${id}/incident`}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            ← Incident Reports
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            New Incident Report
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{safetyProject.name}</p>
          <div className="mt-8">
            <IncidentForm submitAction={createIncidentReport.bind(null, id)} />
          </div>
        </main>
      </div>
    );
  }

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
              Incident Reports
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {safetyProject.name}
              {safetyProject.address && ` · ${safetyProject.address}`}
            </p>
          </div>
          <Link
            href={`/projects/${id}/incident?new=1`}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + Report incident
          </Link>
        </div>

        {incidents.length === 0 ? (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">No incident reports on this project.</p>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {incidents.map((inc) => (
              <div
                key={inc.id}
                className={`overflow-hidden rounded-xl border bg-white dark:bg-zinc-900 ${
                  inc.workSafeNotifiable
                    ? "border-red-200 dark:border-red-800/50"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <div className="flex items-start justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          inc.workSafeNotifiable
                            ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {TYPE_LABELS[inc.incidentType] ?? inc.incidentType}
                      </span>
                      {inc.workSafeNotifiable && (
                        <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                          WorkSafe notifiable
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {inc.incidentAt.toLocaleDateString("en-AU", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        timeZone: "Australia/Melbourne",
                      })}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {inc.location} · Reported by{" "}
                      {inc.reportedBy.name ?? inc.reportedBy.email}
                      {inc.workSafeRefNumber && ` · Ref: ${inc.workSafeRefNumber}`}
                    </p>
                  </div>
                  {inc.reportUrl && (
                    <a
                      href={inc.reportUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      PDF →
                    </a>
                  )}
                </div>
                <div className="px-5 py-4">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 line-clamp-2">
                    {inc.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-6 text-xs text-zinc-500">
          Incident records are retained for a minimum of 5 years per ISO 45001:2018 Clause 10.2.
        </p>
      </main>
    </div>
  );
}
