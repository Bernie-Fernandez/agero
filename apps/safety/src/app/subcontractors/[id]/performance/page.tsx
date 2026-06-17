import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, ADMIN_MANAGER_ROLES } from "@/lib/auth";
import { addPerformanceRecord } from "./actions";
import { PerformanceForm } from "./performance-form";

export default async function SubcontractorPerformancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const appUser = await requireRole([...ADMIN_MANAGER_ROLES, "site_manager"]);

  const org = await prisma.organisation.findUnique({
    where: { id },
    include: {
      subcontractorOnProjects: { include: { project: { select: { id: true, name: true } } } },
      swmsDocuments: { select: { ageroApproved: true, isCurrent: true } },
      swmsSubmissions: { select: { status: true } },
      _count: { select: { employedWorkers: true } },
    },
  });
  if (!org) notFound();

  // Projects this subcontractor works on (ERP) → matching SafetyProjects.
  const erpProjectIds = org.subcontractorOnProjects.map((p) => p.projectId);
  const safetyProjects = await prisma.safetyProject.findMany({
    where: { erpProjectId: { in: erpProjectIds.length ? erpProjectIds : ["00000000-0000-0000-0000-000000000000"] } },
    select: { id: true, name: true, erpProjectId: true },
  });
  const safetyProjectIds = safetyProjects.map((p) => p.id);

  // Aggregate from existing records.
  const [incidentCount, ncrCount, manualRecords, employedWorkers] = await Promise.all([
    safetyProjectIds.length
      ? prisma.incidentReport.count({
          where: {
            projectId: { in: safetyProjectIds },
            injuredPersonOrg: { contains: org.name, mode: "insensitive" },
          },
        })
      : Promise.resolve(0),
    safetyProjectIds.length
      ? prisma.nonConformanceReport.count({
          where: {
            projectId: { in: safetyProjectIds },
            contractorName: { contains: org.name, mode: "insensitive" },
          },
        })
      : Promise.resolve(0),
    prisma.subcontractorPerformanceRecord.findMany({
      where: { organisationId: id },
      include: { project: { select: { name: true } } },
      orderBy: { occurredAt: "desc" },
    }),
    prisma.worker.findMany({
      where: { employingOrganisationId: id },
      select: { id: true, inductionCompletions: { where: { passed: true }, select: { id: true } } },
    }),
  ]);

  // SWMS rejections (Safety platform + ERP submissions).
  const swmsRejections =
    org.swmsDocuments.filter((d) => d.isCurrent && d.ageroApproved === false).length +
    org.swmsSubmissions.filter((s) => s.status === "rejected").length;

  // Induction completion rate.
  const totalWorkers = employedWorkers.length;
  const inductedWorkers = employedWorkers.filter((w) => w.inductionCompletions.length > 0).length;
  const inductionRate = totalWorkers > 0 ? Math.round((inductedWorkers / totalWorkers) * 100) : null;

  const stats = [
    { label: "Projects worked on", value: org.subcontractorOnProjects.length },
    { label: "Incidents", value: incidentCount, danger: incidentCount > 0 },
    { label: "NCRs", value: ncrCount, danger: ncrCount > 0 },
    { label: "SWMS rejections", value: swmsRejections, danger: swmsRejections > 0 },
    {
      label: "Induction completion",
      value: inductionRate === null ? "—" : `${inductionRate}%`,
      danger: inductionRate !== null && inductionRate < 100,
    },
  ];

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/subcontractors" userRole={appUser.role} />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link href={`/subcontractors/${id}`} className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← {org.name}
        </Link>
        <div className="mt-2">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Safety Performance</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {org.name} · ISO 45001 Clause 8.1.4.2 supplier performance evidence
          </p>
        </div>

        {/* Stat cards */}
        <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className={`text-2xl font-semibold ${s.danger ? "text-amber-600 dark:text-amber-400" : "text-zinc-900 dark:text-zinc-50"}`}>
                {s.value}
              </p>
              <p className="mt-1 text-xs text-zinc-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Projects */}
        <div className="mt-8">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-3">Projects</h2>
          {org.subcontractorOnProjects.length === 0 ? (
            <p className="text-sm text-zinc-500">Not assigned to any projects.</p>
          ) : (
            <ul className="space-y-2">
              {org.subcontractorOnProjects.map(({ project }) => {
                const sp = safetyProjects.find((s) => s.erpProjectId === project.id);
                return (
                  <li key={project.id} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                    <Link href={`/projects/${project.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
                      {project.name}
                    </Link>
                    {sp && (
                      <Link href={`/projects/${sp.id}/readiness`} className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                        Readiness →
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Manual performance log */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Performance log</h2>
            <PerformanceForm
              projects={safetyProjects.map((p) => ({ id: p.id, name: p.name }))}
              submitAction={addPerformanceRecord.bind(null, id)}
            />
          </div>
          {manualRecords.length === 0 ? (
            <p className="text-sm text-zinc-500">No manual performance records logged.</p>
          ) : (
            <div className="space-y-2">
              {manualRecords.map((r) => (
                <div key={r.id} className="rounded-xl border border-zinc-200 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {r.recordType.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {r.occurredAt.toLocaleDateString("en-AU")}
                      {r.project ? ` · ${r.project.name}` : ""} · {r.recordedByName}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{r.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
