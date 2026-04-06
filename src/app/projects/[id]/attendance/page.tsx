import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { AttendanceDatePicker } from "./date-picker";
import { AttendanceTable } from "./attendance-table";
import { requireRole, AGERO_ROLES } from "@/lib/auth";

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  const { date } = await searchParams;

  const appUser = await requireRole(AGERO_ROLES);

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || project.organisationId !== appUser.organisationId) notFound();

  const selectedDate = date ? new Date(date) : new Date();
  selectedDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(selectedDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const visits = await prisma.siteVisit.findMany({
    where: {
      projectId: id,
      signedInAt: { gte: selectedDate, lt: nextDay },
    },
    include: {
      worker: { include: { employingOrganisation: true } },
      alert: true,
    },
    orderBy: { signedInAt: "desc" },
  });

  const dateStr = selectedDate.toLocaleDateString("en-AU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Australia/Melbourne",
  });

  const onSiteCount = visits.filter((v) => v.signedOutAt === null).length;

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/projects" userRole={appUser.role} />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 print:py-4">
        <Link href={`/projects/${id}`} className="text-sm text-zinc-500 hover:text-zinc-700 print:hidden">
          ← Back to project
        </Link>
        <div className="mt-2 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Attendance Register — {project.name}
            </h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              {dateStr} · {visits.length} sign-in{visits.length !== 1 ? "s" : ""}
              {onSiteCount > 0 && (
                <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-950/30 dark:text-green-400">
                  {onSiteCount} on site
                </span>
              )}
            </p>
          </div>
          <AttendanceDatePicker
            projectId={id}
            value={selectedDate.toISOString().split("T")[0]}
          />
        </div>

        <AttendanceTable visits={visits} projectId={id} />
      </main>
    </div>
  );
}
