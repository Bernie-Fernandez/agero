import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { createDefectsInspection, updateDefectStatus } from "./actions";
import { DefectsForm } from "./defects-form";
import type { DefectStatus } from "@/generated/prisma/client";

const STATUS_STYLES: Record<DefectStatus, string> = {
  OPEN: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  COMPLETE: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

export default async function DefectsPage({
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
    return (
      <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
        <AppNav currentPath="/projects" userRole={user.role} />
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <Link href={`/projects/${id}/defects`} className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            ← Defects Register
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">New Defects Inspection</h1>
          <p className="mt-1 text-sm text-zinc-500">{safetyProject.name}</p>
          <div className="mt-8">
            <DefectsForm
              submitAction={createDefectsInspection.bind(null, id)}
              floorPlanUrl={safetyProject.floorPlan?.fileUrl ?? null}
            />
          </div>
        </main>
      </div>
    );
  }

  const inspections = await prisma.defectsInspection.findMany({
    where: { projectId: id },
    include: {
      conductedBy: { select: { name: true, email: true } },
      defectItems: { orderBy: { pinNumber: "asc" } },
    },
    orderBy: { conductedAt: "desc" },
  });

  const allItems = inspections.flatMap((i) => i.defectItems);
  const openCount = allItems.filter((d) => d.status === "OPEN").length;
  const inProgressCount = allItems.filter((d) => d.status === "IN_PROGRESS").length;

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/projects" userRole={user.role} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link href={`/projects/${id}/readiness`} className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← {safetyProject.name}
        </Link>

        <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Defects Register</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {safetyProject.name}{safetyProject.address && ` · ${safetyProject.address}`}
            </p>
          </div>
          <Link href={`/projects/${id}/defects?new=1`} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
            + New inspection
          </Link>
        </div>

        {/* Summary */}
        {allItems.length > 0 && (
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 dark:border-red-800/50 dark:bg-red-950/20">
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">{openCount}</p>
              <p className="mt-1 text-xs text-zinc-500">Open defects</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-800/50 dark:bg-amber-950/20">
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{inProgressCount}</p>
              <p className="mt-1 text-xs text-zinc-500">In progress</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{allItems.length}</p>
              <p className="mt-1 text-xs text-zinc-500">Total defects</p>
            </div>
          </div>
        )}

        {inspections.length === 0 ? (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">No defects inspections recorded yet.</p>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {inspections.map((inspection) => (
              <div key={inspection.id} className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {inspection.conductedAt.toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Australia/Melbourne" })}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {inspection.conductedBy.name ?? inspection.conductedBy.email} · {inspection.defectItems.length} item{inspection.defectItems.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {inspection.defectItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${item.status === "COMPLETE" ? "bg-green-600" : item.status === "IN_PROGRESS" ? "bg-amber-500" : "bg-red-600"}`}>
                        {item.pinNumber}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-zinc-900 dark:text-zinc-50 text-sm truncate">{item.description}</p>
                        <p className="text-xs text-zinc-500">
                          {item.tradeResponsible && `${item.tradeResponsible} · `}
                          {item.dueDate && `Due ${new Date(item.dueDate).toLocaleDateString("en-AU")}`}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status]}`}>
                        {item.status === "IN_PROGRESS" ? "In Progress" : item.status === "COMPLETE" ? "Complete" : "Open"}
                      </span>
                      {item.status !== "COMPLETE" && (
                        <form action={updateDefectStatus.bind(null, item.id, id, item.status === "OPEN" ? "IN_PROGRESS" : "COMPLETE")}>
                          <button type="submit" className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">
                            {item.status === "OPEN" ? "Start →" : "Complete ✓"}
                          </button>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
