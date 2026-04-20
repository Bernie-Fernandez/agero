import { redirect } from "next/navigation";
import Link from "next/link";
import { getWorkerSession } from "@/lib/safety/worker-auth";
import { prisma } from "@/lib/safety/prisma";
import { SignOutButton } from "../sign-out-button";
import { SiteTokenInput } from "./site-token-input";

const ANNUAL_MS = 365 * 24 * 60 * 60 * 1000;

function certStatus(expiry: Date | null): "green" | "amber" | "red" {
  if (!expiry) return "red";
  const ms = expiry.getTime() - Date.now();
  if (ms < 0) return "red";
  if (ms < 30 * 24 * 60 * 60 * 1000) return "amber";
  return "green";
}

export default async function WorkerDashboard() {
  const session = await getWorkerSession();
  if (!session) redirect("/worker/login");

  const { workerAccount } = session;

  // All Worker records for this mobile (across projects)
  const workers = await prisma.worker.findMany({
    where: { mobile: workerAccount.mobile },
    include: {
      project: { select: { id: true, name: true, address: true, status: true } },
      inductionCompletions: {
        include: { template: { select: { id: true, type: true, title: true } } },
        orderBy: { signedAt: "desc" },
      },
    },
  });

  const genericTemplate = await prisma.inductionTemplate.findFirst({
    where: { type: "generic", isActive: true },
    orderBy: { version: "desc" },
  });

  // Deduplicate workers by project ID (multiple Worker rows can exist per project)
  const seenProjectIds = new Set<string>();
  const uniqueWorkers = workers.filter((w) => {
    if (seenProjectIds.has(w.project.id)) return false;
    seenProjectIds.add(w.project.id);
    return true;
  });

  const allCompletions = workers.flatMap((w) => w.inductionCompletions);

  const hasCurrentGeneric = genericTemplate
    ? allCompletions.some(
        (c) =>
          c.templateId === genericTemplate.id &&
          c.passed &&
          c.signedAt > new Date(Date.now() - ANNUAL_MS),
      )
    : false;

  const genericYear = hasCurrentGeneric ? new Date().getFullYear() : null;

  const recentVisits = await prisma.siteVisit.findMany({
    where: { workerId: { in: workers.map((w) => w.id) } },
    include: { project: { select: { name: true } } },
    orderBy: { signedInAt: "desc" },
    take: 5,
  });

  const certItems = [
    { label: "White card", expiry: workerAccount.whiteCardExpiry },
    { label: "Trade licence", expiry: workerAccount.tradeLicenceExpiry },
    { label: "First aid", expiry: workerAccount.firstAidExpiry },
  ].filter((i) => i.expiry !== null);

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              {workerAccount.firstName} {workerAccount.lastName}
            </h1>
            {workerAccount.trades.length > 0 && (
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                {workerAccount.trades.join(", ")}
              </p>
            )}
            <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{workerAccount.mobile}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link
              href="/worker/profile"
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Edit profile
            </Link>
            <SignOutButton />
          </div>
        </div>

        {/* Generic induction badge */}
        <div className="mt-4">
          {genericYear ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Generic induction — Completed {genericYear}
            </span>
          ) : (
            <Link
              href={
                genericTemplate
                  ? `/inductions/${genericTemplate.id}${workers[0] ? `?worker=${workers[0].id}` : ""}`
                  : "/worker/inductions"
              }
              className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Generic induction — Required →
            </Link>
          )}
        </div>
      </div>

      {/* Sign in to a site */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Sign in to a site</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Scan the site QR code with your phone camera, or paste a project token below.
        </p>
        <SiteTokenInput />
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/worker/profile"
          className="rounded-xl border border-zinc-200 bg-white p-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          My profile &amp; certs
        </Link>
        <Link
          href="/worker/inductions"
          className="rounded-xl border border-zinc-200 bg-white p-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Induction history
        </Link>
      </div>

      {/* Projects */}
      {uniqueWorkers.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Your projects
          </h2>
          <ul className="space-y-2">
            {uniqueWorkers.map((w) => {
              const hasSiteInduction = w.inductionCompletions.some(
                (c) =>
                  c.template.type === "site_specific" &&
                  c.passed &&
                  c.signedAt > new Date(Date.now() - ANNUAL_MS),
              );

              return (
                <li
                  key={w.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {w.project.name}
                      </p>
                      {w.project.address && (
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">
                          {w.project.address}
                        </p>
                      )}
                    </div>
                    {hasSiteInduction ? (
                      <span className="shrink-0 text-xs font-medium text-green-700 dark:text-green-400">
                        Inducted
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs font-medium text-red-600 dark:text-red-400">
                        Induction required
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Cert expiry */}
      {certItems.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Certifications
          </h2>
          <ul className="space-y-2">
            {certItems.map((item) => {
              const status = certStatus(item.expiry);
              const colour =
                status === "green"
                  ? "text-green-700 dark:text-green-400"
                  : status === "amber"
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400";
              const expired = item.expiry && item.expiry < new Date();
              return (
                <li
                  key={item.label}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{item.label}</p>
                  <span className={`text-xs font-medium ${colour}`}>
                    {expired
                      ? "Expired"
                      : item.expiry
                        ? `Expires ${item.expiry.toLocaleDateString("en-AU")}`
                        : "No expiry"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Recent sign-ins */}
      {recentVisits.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Recent sign-ins
          </h2>
          <ul className="space-y-2">
            {recentVisits.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {v.project.name}
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    {new Date(v.signedInAt).toLocaleString("en-AU", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                {v.signedOutAt ? (
                  <span className="text-xs text-zinc-400">Signed out</span>
                ) : (
                  <span className="text-xs font-medium text-green-700 dark:text-green-400">
                    On site
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
