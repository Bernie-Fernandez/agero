import Link from "next/link";
import { prisma } from "@/lib/safety/prisma";
import { AppNav } from "@/components/safety/safety-nav";
import { CreateProjectForm } from "./create-project-form";
import { ComplianceBadge } from "@/components/safety/compliance-badge";
import { requireRole, AGERO_ROLES } from "@/lib/safety/auth";
import { calcOrgCompliance } from "@/lib/safety/compliance";

export default async function ProjectsPage() {
  const appUser = await requireRole(AGERO_ROLES);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const projects = await prisma.project.findMany({
    where: { organisationId: appUser.organisationId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { workers: true, subcontractors: true } },
      inductionTemplates: { where: { isActive: true }, select: { id: true, type: true } },
      siteVisits: {
        where: { signedInAt: { gte: today, lt: tomorrow } },
        select: { id: true, signedOutAt: true },
      },
      subcontractors: {
        include: {
          subcontractorOrg: {
            include: { documents: true, swmsSubmissions: true },
          },
        },
      },
    },
  });

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/projects" userRole={appUser.role} />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Projects</h1>
        </div>

        <div className="mt-6 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">New project</h2>
          </div>
          <div className="px-5 py-4">
            <CreateProjectForm />
          </div>
        </div>

        <div className="mt-6">
          {projects.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No projects yet.</p>
          ) : (
            <ul className="space-y-2">
              {projects.map((p) => {
                const onSite = p.siteVisits.filter((v) => v.signedOutAt === null).length;
                const hasSiteInduction = p.inductionTemplates.some((t) => t.type === "site_specific");
                const hasGenericInduction = p.inductionTemplates.some((t) => t.type === "generic");
                const subCompliance = p.subcontractors.map((s) =>
                  calcOrgCompliance({ documents: s.subcontractorOrg.documents, swmsSubmissions: s.subcontractorOrg.swmsSubmissions }),
                );
                const hasRed = subCompliance.some((c) => c.status === "red");
                const hasAmber = subCompliance.some((c) => c.status === "amber");
                const ragStatus = hasRed ? "red" : hasAmber ? "amber" : "green";

                return (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}`}
                      className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-4 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-zinc-900 dark:text-zinc-50">{p.name}</p>
                          {p.status && p.status !== "active" && (
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
                              {p.status}
                            </span>
                          )}
                        </div>
                        {p.address && (
                          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{p.address}</p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-zinc-400">{p._count.subcontractors} subcontractors · {p._count.workers} workers</span>
                          {!hasSiteInduction && !hasGenericInduction && (
                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">No induction</span>
                          )}
                          {hasSiteInduction && (
                            <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-xs text-green-700">Induction active</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-4 shrink-0">
                        {onSite > 0 && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-950/30 dark:text-green-400">
                            {onSite} on site
                          </span>
                        )}
                        {p.subcontractors.length > 0 && (
                          <ComplianceBadge status={ragStatus} />
                        )}
                        <span className="text-zinc-300 dark:text-zinc-600">→</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
