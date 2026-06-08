import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole } from "@/lib/auth";
import { ComplianceBadge } from "@/components/compliance-badge";
import { daysUntil, EXPIRY_WARN_DAYS } from "@/lib/compliance";
import type { RagStatus } from "@/lib/compliance";

function credentialStatus(credentials: { expiryDate: Date | null }[]): RagStatus {
  if (credentials.length === 0) return "amber";
  for (const c of credentials) {
    if (!c.expiryDate) continue;
    const days = daysUntil(c.expiryDate);
    if (days < 0) return "red";
    if (days <= EXPIRY_WARN_DAYS) return "amber";
  }
  return "green";
}

export default async function SubcontractorPortalPage() {
  const appUser = await requireRole(["subcontractor_admin"]);

  const org = await prisma.organisation.findUnique({
    where: { id: appUser.organisationId },
    select: { name: true, abn: true },
  });

  const workers = await prisma.worker.findMany({
    where: { employingOrganisationId: appUser.organisationId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      trade: true,
      credentials: {
        select: { credentialType: true, expiryDate: true, isVerified: true },
      },
      inductionCompletions: {
        select: {
          passed: true,
          signedAt: true,
          template: { select: { title: true, type: true } },
        },
        orderBy: { signedAt: "desc" },
        take: 5,
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/portal" userRole={appUser.role} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Subcontractor Portal
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {org?.name}
          {org?.abn && <span className="ml-2 text-xs text-zinc-400">ABN {org.abn}</span>}
        </p>

        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Workers ({workers.length})
            </h2>
          </div>

          {workers.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm text-zinc-500">No workers registered yet.</p>
              <p className="mt-1 text-xs text-zinc-400">
                Contact your Agero project manager to add workers.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {workers.map((worker) => {
                const credStatus = credentialStatus(worker.credentials);
                const inductionPassed = worker.inductionCompletions.some(
                  (c) => c.passed && c.template.type === "generic",
                );
                const expiringCreds = worker.credentials.filter((c) => {
                  if (!c.expiryDate) return false;
                  const d = daysUntil(c.expiryDate);
                  return d >= 0 && d <= EXPIRY_WARN_DAYS;
                });
                const expiredCreds = worker.credentials.filter(
                  (c) => c.expiryDate && daysUntil(c.expiryDate) < 0,
                );

                return (
                  <Link
                    key={worker.id}
                    href={`/portal/workers/${worker.id}`}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-4 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                  >
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">
                        {worker.firstName} {worker.lastName}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                        {worker.trade && <span>{worker.trade}</span>}
                        <span>{worker.credentials.length} credential{worker.credentials.length !== 1 ? "s" : ""}</span>
                        {inductionPassed ? (
                          <span className="text-green-600 dark:text-green-400">Induction complete</span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">Induction pending</span>
                        )}
                      </div>
                      {(expiredCreds.length > 0 || expiringCreds.length > 0) && (
                        <div className="mt-1 flex flex-wrap gap-2">
                          {expiredCreds.length > 0 && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              {expiredCreds.length} expired
                            </span>
                          )}
                          {expiringCreds.length > 0 && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              {expiringCreds.length} expiring soon
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <ComplianceBadge status={credStatus} />
                      <span className="text-sm text-zinc-400">→</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-8 rounded-xl border border-zinc-100 bg-white p-5 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="font-medium text-zinc-700 dark:text-zinc-300">What you can manage here</p>
          <p className="mt-1">
            Upload and maintain credentials (white cards, HRWLs, trade certificates) for your workers.
            Contact your Agero project manager for project access, SWMS, or site sign-in issues.
          </p>
        </div>
      </main>
    </div>
  );
}
