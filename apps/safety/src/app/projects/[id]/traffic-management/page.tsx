import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { createTrafficReview } from "./actions";
import { TrafficForm } from "./traffic-form";

export default async function TrafficManagementPage({
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
    select: { id: true, name: true, organisationId: true },
  });
  if (!safetyProject || safetyProject.organisationId !== user.organisationId) notFound();

  const reviews = await prisma.trafficManagementReview.findMany({
    where: { projectId: id },
    include: { conductedBy: { select: { name: true, email: true } } },
    orderBy: { conductedAt: "desc" },
  });

  if (showNew === "1") {
    return (
      <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
        <AppNav currentPath="/projects" userRole={user.role} />
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <Link href={`/projects/${id}/traffic-management`} className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            ← Traffic Management
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            New Traffic Management Review
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{safetyProject.name}</p>
          <div className="mt-8">
            <TrafficForm submitAction={createTrafficReview.bind(null, id)} />
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
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Traffic Management</h1>
            <p className="mt-1 text-sm text-zinc-500">Review checklist & hazard assessment · AS 1742.3-2009</p>
          </div>
          <Link
            href={`/projects/${id}/traffic-management?new=1`}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + New review
          </Link>
        </div>

        {reviews.length === 0 ? (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">No traffic management reviews recorded yet.</p>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {reviews.map((r) => {
              const reviewItems = r.reviewItems as { answer: string }[];
              const hazards = r.hazards as { hazard: string; riskRating: string }[];
              const noCount = reviewItems.filter((i) => i.answer === "NO").length;
              return (
                <div key={r.id} className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-start justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {r.conductedAt.toLocaleDateString("en-AU", { timeZone: "Australia/Melbourne" })}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {r.conductedBy.name ?? r.conductedBy.email} · {hazards.length} hazard{hazards.length !== 1 ? "s" : ""}
                        {noCount > 0 ? ` · ${noCount} item${noCount !== 1 ? "s" : ""} not in place` : ""}
                      </p>
                    </div>
                    {r.reportUrl && (
                      <a href={r.reportUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline dark:text-blue-400">
                        PDF →
                      </a>
                    )}
                  </div>
                  <div className="px-5 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {hazards.map((h, i) => (
                        <span key={i} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          {h.hazard} · {h.riskRating}
                        </span>
                      ))}
                    </div>
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
