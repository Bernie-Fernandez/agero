import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { ComplianceBadge } from "@/components/compliance-badge";
import { calcOrgCompliance } from "@/lib/compliance";

export default async function SubcontractorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const appUser = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (!appUser) redirect("/onboarding");

  const orgs = await prisma.organisation.findMany({
    where: {
      id: { not: appUser.organisationId },
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { name: "asc" },
    include: {
      documents: true,
      swmsSubmissions: { orderBy: { versionNumber: "desc" } },
      _count: { select: { employedWorkers: true, subcontractorOnProjects: true } },
    },
  });

  // Calculate RAG for each org and optionally filter
  const orgsWithStatus = orgs.map((org) => {
    const { status: ragStatus, reasons } = calcOrgCompliance({
      documents: org.documents,
      swmsSubmissions: org.swmsSubmissions,
    });
    return { org, ragStatus, reasons };
  });

  const filtered = status && status !== "all"
    ? orgsWithStatus.filter((o) => o.ragStatus === status)
    : orgsWithStatus;

  const counts = {
    all: orgsWithStatus.length,
    green: orgsWithStatus.filter((o) => o.ragStatus === "green").length,
    amber: orgsWithStatus.filter((o) => o.ragStatus === "amber").length,
    red: orgsWithStatus.filter((o) => o.ragStatus === "red").length,
  };

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/subcontractors" />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Subcontractors</h1>
          <Link href="/subcontractors/new"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900">
            Invite new subcontractor
          </Link>
        </div>

        {/* Search and filter */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <form className="flex-1 min-w-48">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search by company name…"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </form>
          <div className="flex items-center gap-1">
            {(["all", "green", "amber", "red"] as const).map((s) => (
              <Link
                key={s}
                href={s === "all" ? "/subcontractors" : `/subcontractors?status=${s}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  (status ?? "all") === s
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {s === "all" ? `All (${counts.all})` :
                 s === "green" ? `Compliant (${counts.green})` :
                 s === "amber" ? `Action needed (${counts.amber})` :
                 `Non-compliant (${counts.red})`}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-5">
          {filtered.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {q ? `No subcontractors matching "${q}"` : "No subcontractors yet."}{" "}
              <Link href="/subcontractors/new" className="text-blue-600 hover:underline">Invite one →</Link>
            </p>
          ) : (
            <ul className="space-y-2">
              {filtered.map(({ org, ragStatus, reasons }) => (
                <li key={org.id}>
                  <Link
                    href={`/subcontractors/${org.id}`}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-4 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">{org.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                        {org.abn && <span>ABN {org.abn}</span>}
                        <span>{org._count.employedWorkers} workers</span>
                        <span>{org._count.subcontractorOnProjects} project{org._count.subcontractorOnProjects !== 1 ? "s" : ""}</span>
                      </div>
                      {org.tradeCategories.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {org.tradeCategories.slice(0, 4).map((t) => (
                            <span key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
                              {t}
                            </span>
                          ))}
                          {org.tradeCategories.length > 4 && (
                            <span className="text-xs text-zinc-400">+{org.tradeCategories.length - 4}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="ml-4 flex items-center gap-3 shrink-0">
                      <ComplianceBadge status={ragStatus} reasons={reasons} />
                      <span className="text-zinc-300 dark:text-zinc-600">→</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
