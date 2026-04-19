import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { ComplianceBadge } from "@/components/compliance-badge";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { calcOrgCompliance, daysUntil, EXPIRY_WARN_DAYS, formatDocType } from "@/lib/compliance";

export default async function DashboardPage() {
  const appUser = await requireRole(AGERO_ROLES);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const warnDate = new Date(Date.now() + EXPIRY_WARN_DAYS * 24 * 60 * 60 * 1000);

  const org = await prisma.organisation.findUnique({
    where: { id: appUser.organisationId },
    select: { name: true, abn: true },
  });

  // Active projects with subcontractor compliance
  const projects = await prisma.project.findMany({
    where: { organisationId: appUser.organisationId },
    include: {
      subcontractors: {
        include: {
          subcontractorOrg: {
            include: { documents: true, swmsSubmissions: true },
          },
        },
      },
      siteVisits: {
        where: { signedInAt: { gte: today, lt: tomorrow } },
        select: { id: true, signedOutAt: true },
      },
      _count: { select: { workers: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Workers on site right now
  const workersOnSite = projects.reduce(
    (sum, p) => sum + p.siteVisits.filter((v) => v.signedOutAt === null).length,
    0,
  );

  // Total sign-ins today
  const signInsToday = projects.reduce((sum, p) => sum + p.siteVisits.length, 0);

  // Pending verifications
  const pendingVerifications = await prisma.verificationAlert.count({
    where: {
      verifiedAt: null,
      siteVisit: { project: { organisationId: appUser.organisationId } },
    },
  });

  // SWMS pending review
  const swmsPending = await prisma.swmsSubmission.count({
    where: {
      project: { organisationId: appUser.organisationId },
      status: "pending_review",
    },
  });

  // Expiring documents in next 30 days (subcontractor orgs)
  const expiringDocs = await prisma.documentUpload.findMany({
    where: {
      organisation: {
        subcontractorOnProjects: {
          some: { project: { organisationId: appUser.organisationId } },
        },
      },
      expiryDate: { gte: today, lte: warnDate },
    },
    include: { organisation: true },
    orderBy: { expiryDate: "asc" },
    take: 10,
  });

  // Compliance breakdown across all subcontractors linked to this org's projects
  const allSubOrgs = await prisma.organisation.findMany({
    where: {
      subcontractorOnProjects: {
        some: { project: { organisationId: appUser.organisationId } },
      },
    },
    include: { documents: true, swmsSubmissions: true },
  });

  const complianceCounts = allSubOrgs.reduce(
    (acc, org) => {
      const { status } = calcOrgCompliance({ documents: org.documents, swmsSubmissions: org.swmsSubmissions });
      acc[status]++;
      return acc;
    },
    { green: 0, amber: 0, red: 0 },
  );

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/dashboard" userRole={appUser.role} />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          {org?.name}
          {org?.abn && <span className="ml-2 text-xs text-zinc-400">ABN {org.abn}</span>}
        </p>

        {/* Key metrics */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Workers on site" value={workersOnSite} href="/supervisor" accent="green" />
          <StatCard label="Sign-ins today" value={signInsToday} href="/supervisor" />
          <StatCard
            label="Pending verifications"
            value={pendingVerifications}
            href="/supervisor"
            accent={pendingVerifications > 0 ? "amber" : undefined}
          />
          <StatCard
            label="SWMS awaiting review"
            value={swmsPending}
            href="/projects"
            accent={swmsPending > 0 ? "amber" : undefined}
          />
        </div>

        {/* Compliance summary */}
        {allSubOrgs.length > 0 && (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Subcontractor compliance — {allSubOrgs.length} companies
            </h2>
            <div className="mt-3 flex gap-4">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{complianceCounts.green} compliant</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{complianceCounts.amber} action required</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{complianceCounts.red} non-compliant</span>
              </div>
            </div>
          </div>
        )}

        {/* Expiring documents */}
        {expiringDocs.length > 0 && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/20">
            <h2 className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Documents expiring within 30 days
            </h2>
            <ul className="mt-3 space-y-1.5">
              {expiringDocs.map((doc) => {
                const days = doc.expiryDate ? daysUntil(doc.expiryDate) : null;
                return (
                  <li key={doc.id} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {doc.organisation?.name} — {formatDocType(doc.type)}
                    </span>
                    <span className={`text-xs font-medium ${days !== null && days <= 7 ? "text-red-600" : "text-amber-600"}`}>
                      {days !== null ? (days <= 0 ? "Expired" : `${days}d`) : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
            <Link href="/subcontractors" className="mt-3 block text-xs text-amber-700 hover:underline dark:text-amber-400">
              Manage subcontractor documents →
            </Link>
          </div>
        )}

        {/* Projects with compliance */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
              Projects ({projects.length})
            </h2>
            <Link href="/projects" className="text-sm text-zinc-500 hover:text-zinc-700">
              Manage →
            </Link>
          </div>
          {projects.length === 0 ? (
            <p className="text-sm text-zinc-500">No projects yet.</p>
          ) : (
            <ul className="space-y-2">
              {projects.map((p) => {
                const onSite = p.siteVisits.filter((v) => v.signedOutAt === null).length;
                const subCompliance = p.subcontractors.map((s) =>
                  calcOrgCompliance({ documents: s.subcontractorOrg.documents, swmsSubmissions: s.subcontractorOrg.swmsSubmissions }),
                );
                const hasRed = subCompliance.some((c) => c.status === "red");
                const hasAmber = subCompliance.some((c) => c.status === "amber");
                const ragStatus = hasRed ? "red" : hasAmber ? "amber" : "green";

                return (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}`}
                      className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-4 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                    >
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">{p.name}</p>
                        <p className="mt-0.5 text-sm text-zinc-500">
                          {p._count.workers} workers · {p.subcontractors.length} subcontractors
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {onSite > 0 && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-950/30 dark:text-green-400">
                            {onSite} on site
                          </span>
                        )}
                        {p.subcontractors.length > 0 && (
                          <ComplianceBadge status={ragStatus} />
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Quick actions */}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/projects"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Manage projects
          </Link>
          <Link
            href="/subcontractors"
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Manage subcontractors
          </Link>
          <Link
            href="/supervisor"
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Supervisor view
          </Link>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  accent,
}: {
  label: string;
  value: number;
  href: string;
  accent?: "green" | "amber" | "red";
}) {
  const accentClass =
    accent === "green"
      ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20"
      : accent === "amber"
      ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20"
      : accent === "red"
      ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
      : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";

  return (
    <Link
      href={href}
      className={`rounded-xl border p-5 transition hover:opacity-90 ${accentClass}`}
    >
      <p className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
    </Link>
  );
}
