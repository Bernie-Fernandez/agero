import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { controlLevelLabel, type ControlLevel } from "@/lib/hierarchy-of-controls";
import { createManualHandling } from "./actions";
import { ManualHandlingForm } from "./manual-handling-form";

export default async function ManualHandlingPage({
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

  const assessments = await prisma.manualHandlingAssessment.findMany({
    where: { projectId: id },
    include: { conductedBy: { select: { name: true, email: true } } },
    orderBy: { conductedAt: "desc" },
  });

  if (showNew === "1") {
    return (
      <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
        <AppNav currentPath="/projects" userRole={user.role} />
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <Link href={`/projects/${id}/manual-handling`} className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            ← Manual Handling Assessments
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            New Manual Handling Risk Assessment
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{safetyProject.name}</p>
          <div className="mt-8">
            <ManualHandlingForm submitAction={createManualHandling.bind(null, id)} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/projects" userRole={user.role} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link href={`/projects/${id}/readiness`} className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← {safetyProject.name}
        </Link>
        <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Manual Handling Assessments</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Hierarchy of controls enforced · VIC Hazardous Manual Handling Compliance Code
            </p>
          </div>
          <Link
            href={`/projects/${id}/manual-handling?new=1`}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + New assessment
          </Link>
        </div>

        {assessments.length === 0 ? (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">No manual handling assessments recorded yet.</p>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {assessments.map((a) => {
              const controls = a.controls as { level: ControlLevel; description: string }[];
              return (
                <div key={a.id} className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-start justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{a.taskDescription}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {a.conductedAt.toLocaleDateString("en-AU", { timeZone: "Australia/Melbourne" })} ·{" "}
                        {a.conductedBy.name ?? a.conductedBy.email}
                        {a.location ? ` · ${a.location}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {a.ppeOnly && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          PPE-only (justified)
                        </span>
                      )}
                      {a.reportUrl && (
                        <a href={a.reportUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline dark:text-blue-400">
                          PDF →
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-xs font-medium text-zinc-500 mb-1">Controls ({controls.length})</p>
                    <ul className="space-y-0.5">
                      {controls.map((c, i) => (
                        <li key={i} className="text-xs text-zinc-600 dark:text-zinc-400">
                          • <span className="text-zinc-400">{controlLevelLabel(c.level)}:</span> {c.description}
                        </li>
                      ))}
                    </ul>
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
