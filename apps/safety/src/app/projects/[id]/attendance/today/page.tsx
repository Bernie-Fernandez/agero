import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { AutoRefresh } from "./auto-refresh";

export default async function DailyAttendancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const appUser = await requireRole(AGERO_ROLES);

  // id in this route is ERP project ID (same as parent /attendance)
  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true, organisationId: true },
  });
  if (!project || project.organisationId !== appUser.organisationId) notFound();

  // SafetyProject for back-link and visitor sign-ins
  const safetyProject = await prisma.safetyProject.findUnique({
    where: { erpProjectId: id },
    select: { id: true },
  });

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [visits, visitors] = await Promise.all([
    prisma.siteVisit.findMany({
      where: {
        projectId: id,
        signedInAt: { gte: todayStart, lt: todayEnd },
      },
      include: {
        worker: {
          include: {
            employingOrganisation: { select: { id: true, name: true } },
            credentials: {
              where: { credentialType: "FIRST_AID" },
              select: { id: true, expiryDate: true },
            },
          },
        },
      },
      orderBy: { signedInAt: "asc" },
    }),
    safetyProject
      ? prisma.visitorSignIn.findMany({
          where: {
            projectId: safetyProject.id,
            acknowledgedAt: { gte: todayStart, lt: todayEnd },
          },
          orderBy: { acknowledgedAt: "asc" },
        })
      : [],
  ]);

  // Stats
  const onSiteWorkers = visits.filter((v) => !v.signedOutAt);
  const onSiteVisitors = visitors.filter((v) => !v.signedOutAt);

  // Person-hours — workers only
  let totalMs = 0;
  for (const v of visits) {
    const end = v.signedOutAt ?? now;
    totalMs += end.getTime() - v.signedInAt.getTime();
  }
  const personHours = totalMs / (1000 * 60 * 60);

  // First aider check — any on-site worker with FIRST_AID credential
  const hasFirstAider = onSiteWorkers.some((v) => v.worker.credentials.length > 0);

  // Group on-site workers by company
  type WorkerRow = typeof visits[number];
  const companiesMap = new Map<string, WorkerRow[]>();
  for (const v of visits) {
    const co = v.worker.employingOrganisation?.name ?? "Unknown Company";
    if (!companiesMap.has(co)) companiesMap.set(co, []);
    companiesMap.get(co)!.push(v);
  }

  const timeStr = now.toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Australia/Melbourne",
  });
  const dateStr = now.toLocaleDateString("en-AU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Australia/Melbourne",
  });

  const backHref = safetyProject
    ? `/projects/${safetyProject.id}/readiness`
    : `/projects/${id}`;

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/projects" userRole={appUser.role} />
      <AutoRefresh intervalMs={60000} />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <Link
            href={backHref}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            ← {project.name}
          </Link>
          <Link
            href={`/projects/${id}/attendance`}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Attendance register →
          </Link>
        </div>

        <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Daily Dashboard
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {dateStr} · refreshed at {timeStr}
            </p>
          </div>
          <a
            href={`/projects/${id}/attendance/today/export.csv`}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Export CSV
          </a>
        </div>

        {/* First Aider alert */}
        {onSiteWorkers.length > 0 && !hasFirstAider && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-950/20">
            <span className="text-amber-600 dark:text-amber-400 mt-0.5">⚠</span>
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                No First Aider on site
              </p>
              <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                A qualified First Aider must be present whenever workers are on site. Check worker credentials or contact the site manager.
              </p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Workers on site" value={onSiteWorkers.length} />
          <StatCard label="Visitors on site" value={onSiteVisitors.length} />
          <StatCard
            label="Person-hours today"
            value={personHours.toFixed(1)}
          />
          <StatCard
            label="First Aider"
            value={hasFirstAider ? "Present" : onSiteWorkers.length === 0 ? "—" : "Missing"}
            highlight={!hasFirstAider && onSiteWorkers.length > 0 ? "amber" : hasFirstAider ? "green" : undefined}
          />
        </div>

        {/* Workers by company */}
        <div className="mt-8">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Workers — {visits.length} sign-in{visits.length !== 1 ? "s" : ""} today
          </h2>

          {visits.length === 0 ? (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm text-zinc-500">No workers have signed in today.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {[...companiesMap.entries()].map(([company, rows]) => {
                const coOnSite = rows.filter((v) => !v.signedOutAt).length;
                return (
                  <div
                    key={company}
                    className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {company}
                      </p>
                      <span className="text-xs text-zinc-500">
                        {coOnSite} of {rows.length} on site
                      </span>
                    </div>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {rows.map((v) => {
                        const isOnSite = !v.signedOutAt;
                        const durationMs = (v.signedOutAt ?? now).getTime() - v.signedInAt.getTime();
                        const durationHrs = (durationMs / (1000 * 60 * 60)).toFixed(1);
                        const firstAider = v.worker.credentials.length > 0;
                        return (
                          <div
                            key={v.id}
                            className="flex items-center gap-3 px-5 py-3 text-sm"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-zinc-900 dark:text-zinc-50 truncate">
                                {v.worker.firstName} {v.worker.lastName}
                                {firstAider && (
                                  <span className="ml-2 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                    First Aider
                                  </span>
                                )}
                              </p>
                              {v.worker.trade && (
                                <p className="text-xs text-zinc-500">{v.worker.trade}</p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-zinc-500 text-xs">
                                In {v.signedInAt.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", timeZone: "Australia/Melbourne" })}
                                {v.signedOutAt && (
                                  <> · Out {v.signedOutAt.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", timeZone: "Australia/Melbourne" })}</>
                                )}
                              </p>
                              <p className="text-xs text-zinc-400">{durationHrs} hrs</p>
                            </div>
                            <span
                              className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 ${
                                isOnSite
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                                  : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                              }`}
                            >
                              {isOnSite ? "On site" : "Left"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Visitors */}
        <div className="mt-8">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Visitors — {visitors.length} today
          </h2>

          {visitors.length === 0 ? (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm text-zinc-500">No visitors today.</p>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {visitors.map((v) => {
                  const isOnSite = !v.signedOutAt;
                  return (
                    <div key={v.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">
                          {v.visitorName}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {[v.company, v.purpose].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-zinc-500">
                          In {v.acknowledgedAt.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", timeZone: "Australia/Melbourne" })}
                          {v.signedOutAt && (
                            <> · Out {v.signedOutAt.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", timeZone: "Australia/Melbourne" })}</>
                          )}
                        </p>
                      </div>
                      <span
                        className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 ${
                          isOnSite
                            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {isOnSite ? "On site" : "Left"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Visitor sign-in link */}
        {safetyProject && (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Visitor sign-in
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Visitors sign in at the dedicated kiosk page.
            </p>
            <Link
              href={`/projects/${safetyProject.id}/visitors/sign-in`}
              className="mt-2 inline-block rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Open visitor sign-in →
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "amber" | "green";
}) {
  return (
    <div
      className={`rounded-xl border px-5 py-4 ${
        highlight === "amber"
          ? "border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/20"
          : highlight === "green"
            ? "border-green-200 bg-green-50 dark:border-green-800/50 dark:bg-green-950/20"
            : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      <p
        className={`text-2xl font-bold ${
          highlight === "amber"
            ? "text-amber-700 dark:text-amber-300"
            : highlight === "green"
              ? "text-green-700 dark:text-green-300"
              : "text-zinc-900 dark:text-zinc-50"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  );
}
