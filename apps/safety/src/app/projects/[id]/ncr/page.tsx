import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { createNcr } from "./actions";
import { NcrForm } from "./ncr-form";

export default async function NcrPage({
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

  const ncrs = await prisma.nonConformanceReport.findMany({
    where: { projectId: id },
    include: { raisedBy: { select: { name: true, email: true } } },
    orderBy: { raisedAt: "desc" },
  });

  if (showNew === "1") {
    return (
      <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
        <AppNav currentPath="/projects" userRole={user.role} />
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <Link
            href={`/projects/${id}/ncr`}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            ← Non-Conformance Reports
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            New NCR
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{safetyProject.name}</p>
          <div className="mt-8">
            <NcrForm submitAction={createNcr.bind(null, id)} />
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
              Non-Conformance Reports
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {safetyProject.name}
              {safetyProject.address && ` · ${safetyProject.address}`}
            </p>
          </div>
          <Link
            href={`/projects/${id}/ncr?new=1`}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + Raise NCR
          </Link>
        </div>

        {ncrs.length === 0 ? (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">No non-conformance reports on this project.</p>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {ncrs.map((ncr) => (
              <div
                key={ncr.id}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {ncr.ncrNumber}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Raised by {ncr.raisedBy.name ?? ncr.raisedBy.email} ·{" "}
                      {ncr.raisedAt.toLocaleDateString("en-AU")}
                      {ncr.contractorName && ` · Contractor: ${ncr.contractorName}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {ncr.reportUrl && (
                      <a
                        href={ncr.reportUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        PDF →
                      </a>
                    )}
                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      Submitted
                    </span>
                  </div>
                </div>
                <div className="px-5 py-4 space-y-2">
                  <div>
                    <p className="text-xs font-medium text-zinc-500">Description</p>
                    <p className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300 line-clamp-2">
                      {ncr.description}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-500">Corrective action</p>
                    <p className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300 line-clamp-2">
                      {ncr.correctiveAction}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
