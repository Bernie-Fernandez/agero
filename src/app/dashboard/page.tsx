import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, AGERO_ROLES } from "@/lib/auth";

export default async function DashboardPage() {
  const appUser = await requireRole(AGERO_ROLES);

  const appUserWithOrg = await prisma.user.findUnique({
    where: { id: appUser.id },
    include: {
      organisation: {
        include: {
          _count: { select: { projects: true, employedWorkers: true } },
        },
      },
    },
  });

  if (!appUserWithOrg) return null;

  const { organisation } = appUserWithOrg;

  const subcontractorCount = await prisma.organisation.count({
    where: { id: { not: appUser.organisationId } },
  });

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/dashboard" userRole={appUser.role} />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Dashboard
        </h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          {organisation.name}
          {organisation.abn ? (
            <span className="ml-2 text-xs text-zinc-400">ABN {organisation.abn}</span>
          ) : null}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <StatCard
            href="/projects"
            label="Projects"
            value={organisation._count.projects}
          />
          <StatCard
            href="/subcontractors"
            label="Subcontractors"
            value={subcontractorCount}
          />
          <StatCard
            href="/organisations"
            label="Workers on site"
            value={organisation._count.employedWorkers}
          />
        </div>

        <div className="mt-8 flex gap-3">
          <Link
            href="/projects"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Manage projects
          </Link>
          <Link
            href="/organisations"
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Manage subcontractors
          </Link>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: number;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <p className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
    </Link>
  );
}
