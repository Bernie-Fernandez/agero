import Link from "next/link";
import { prisma } from "@/lib/safety/prisma";
import { AppNav } from "@/components/safety/safety-nav";
import { requireRole, AGERO_ROLES } from "@/lib/safety/auth";
import { escalateAlert } from "./actions";

const ONE_HOUR_MS = 60 * 60 * 1000;

function minutesAgo(date: Date): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 60000);
}

export default async function SupervisorPage() {
  const appUser = await requireRole(AGERO_ROLES);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // All projects for this org
  const projects = await prisma.project.findMany({
    where: { organisationId: appUser.organisationId },
    include: {
      siteVisits: {
        where: { signedInAt: { gte: today, lt: tomorrow } },
        select: { id: true, signedOutAt: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // Unverified alerts (not yet verified, across all org projects)
  const alerts = await prisma.verificationAlert.findMany({
    where: {
      verifiedAt: null,
      siteVisit: {
        project: { organisationId: appUser.organisationId },
      },
    },
    include: {
      siteVisit: {
        include: {
          worker: { select: { firstName: true, lastName: true } },
          project: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { alertedAt: "asc" },
  });

  const totalOnSite = projects.reduce(
    (sum, p) => sum + p.siteVisits.filter((v) => v.signedOutAt === null).length,
    0,
  );

  const overdueAlerts = alerts.filter(
    (a) => !a.escalatedAt && Date.now() - new Date(a.alertedAt).getTime() > ONE_HOUR_MS,
  );

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/supervisor" userRole={appUser.role} />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Supervisor Dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {new Date().toLocaleDateString("en-AU", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: "Australia/Melbourne",
          })}
        </p>

        {/* Summary stats */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{totalOnSite}</p>
            <p className="mt-1 text-sm text-zinc-500">Workers on site now</p>
          </div>
          <div className={`rounded-xl border p-5 ${
            alerts.length > 0
              ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20"
              : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
          }`}>
            <p className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{alerts.length}</p>
            <p className="mt-1 text-sm text-zinc-500">Pending verifications</p>
          </div>
          <div className={`rounded-xl border p-5 ${
            overdueAlerts.length > 0
              ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
              : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
          }`}>
            <p className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{overdueAlerts.length}</p>
            <p className="mt-1 text-sm text-zinc-500">Overdue (&gt;1 hr)</p>
          </div>
        </div>

        {/* Pending verifications */}
        {alerts.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
              Pending verifications
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Workers who signed in without a pre-verified record. Verify within 1 hour or escalate.
            </p>
            <div className="mt-3 space-y-2">
              {alerts.map((alert) => {
                const mins = minutesAgo(alert.alertedAt);
                const isOverdue = mins >= 60 && !alert.escalatedAt;
                const isEscalated = !!alert.escalatedAt;

                return (
                  <div
                    key={alert.id}
                    className={`flex items-center justify-between rounded-xl border px-5 py-4 ${
                      isEscalated
                        ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                        : isOverdue
                        ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
                        : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20"
                    }`}
                  >
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">
                        {alert.siteVisit.worker.firstName} {alert.siteVisit.worker.lastName}
                      </p>
                      <p className="mt-0.5 text-sm text-zinc-500">
                        {alert.siteVisit.project.name} ·{" "}
                        {mins < 60
                          ? `${mins} min ago`
                          : `${Math.floor(mins / 60)}h ${mins % 60}min ago`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/projects/${alert.siteVisit.project.id}/attendance`}
                        className="rounded border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800"
                      >
                        View
                      </Link>
                      {isEscalated ? (
                        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                          Escalated
                        </span>
                      ) : isOverdue ? (
                        <form action={escalateAlert.bind(null, alert.id)}>
                          <button
                            type="submit"
                            className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                          >
                            Escalate
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-amber-600">
                          {60 - mins} min remaining
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Project attendance summary */}
        <div className="mt-8">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Today&apos;s attendance by project
          </h2>
          <div className="mt-3 space-y-2">
            {projects.map((project) => {
              const signedIn = project.siteVisits.length;
              const onSite = project.siteVisits.filter((v) => v.signedOutAt === null).length;
              const signedOut = signedIn - onSite;

              return (
                <div
                  key={project.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div>
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {project.name}
                    </Link>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      {signedIn} sign-in{signedIn !== 1 ? "s" : ""}
                      {signedOut > 0 && `, ${signedOut} signed out`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {onSite > 0 && (
                      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/30 dark:text-green-400">
                        {onSite} on site
                      </span>
                    )}
                    <Link
                      href={`/projects/${project.id}/attendance`}
                      className="text-sm text-zinc-400 hover:text-zinc-600"
                    >
                      →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
