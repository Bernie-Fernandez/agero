import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { ComplianceBadge } from "@/components/compliance-badge";
import { calcOrgCompliance } from "@/lib/compliance";
import { CreateOrgForm } from "./create-org-form";

export default async function OrganisationsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const appUser = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (!appUser) redirect("/onboarding");

  const orgs = await prisma.organisation.findMany({
    where: { id: { not: appUser.organisationId } },
    orderBy: { name: "asc" },
    include: {
      documents: true,
      _count: { select: { employedWorkers: true } },
    },
  });

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/organisations" />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Subcontractors</h1>

        <div className="mt-6 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Add subcontractor company</h2>
          </div>
          <div className="px-5 py-4">
            <CreateOrgForm />
          </div>
        </div>

        <div className="mt-6">
          {orgs.length === 0 ? (
            <p className="text-sm text-zinc-500">No subcontractor companies yet.</p>
          ) : (
            <ul className="space-y-2">
              {orgs.map((org) => {
                const { status, reasons } = calcOrgCompliance(org);
                return (
                  <li key={org.id}>
                    <Link
                      href={`/organisations/${org.id}`}
                      className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-4 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                    >
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">{org.name}</p>
                        <div className="mt-0.5 flex items-center gap-3 text-xs text-zinc-500">
                          {org.abn && <span>ABN {org.abn}</span>}
                          {org.tradeCategory && <span>{org.tradeCategory}</span>}
                          <span>{org._count.employedWorkers} workers</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <ComplianceBadge status={status} reasons={reasons} />
                        <span className="text-zinc-300 dark:text-zinc-600">→</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
