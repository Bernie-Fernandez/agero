import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { CreateProjectForm } from "./create-project-form";
import { requireRole, AGERO_ROLES } from "@/lib/auth";

export default async function ProjectsPage() {
  const appUser = await requireRole(AGERO_ROLES);

  const projects = await prisma.project.findMany({
    where: { organisationId: appUser.organisationId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { workers: true, subcontractors: true } },
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
              {projects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.id}`}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-4 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                  >
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">{p.name}</p>
                      {p.address && (
                        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{p.address}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                      <span>{p._count.subcontractors} subcontractors</span>
                      <span>{p._count.workers} workers</span>
                      <span className="text-zinc-300 dark:text-zinc-600">→</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
