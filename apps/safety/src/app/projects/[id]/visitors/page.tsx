import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { signOutVisitor } from "./actions";

export default async function VisitorsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole(AGERO_ROLES);

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id },
    select: { id: true, name: true, address: true, organisationId: true },
  });
  if (!safetyProject || safetyProject.organisationId !== user.organisationId) notFound();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [todayVisitors, recentVisitors] = await Promise.all([
    prisma.visitorSignIn.findMany({
      where: { projectId: id, acknowledgedAt: { gte: todayStart, lt: todayEnd } },
      orderBy: { acknowledgedAt: "desc" },
    }),
    prisma.visitorSignIn.findMany({
      where: { projectId: id, acknowledgedAt: { lt: todayStart } },
      orderBy: { acknowledgedAt: "desc" },
      take: 20,
    }),
  ]);

  const onSiteCount = todayVisitors.filter((v) => !v.signedOutAt).length;

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/projects" userRole={user.role} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link
          href={`/projects/${id}/readiness`}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          ← {safetyProject.name}
        </Link>

        <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Visitor Management
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {safetyProject.name}
              {safetyProject.address && ` · ${safetyProject.address}`}
            </p>
          </div>
          <div className="flex gap-2">
            {onSiteCount > 0 && (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300">
                {onSiteCount} on site now
              </span>
            )}
            <Link
              href={`/projects/${id}/visitors/sign-in`}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              Visitor kiosk →
            </Link>
          </div>
        </div>

        {/* Today */}
        <div className="mt-8">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Today — {todayVisitors.length} visit{todayVisitors.length !== 1 ? "s" : ""}
          </h2>
          {todayVisitors.length === 0 ? (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm text-zinc-500">No visitors today.</p>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {todayVisitors.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">{v.visitorName}</p>
                      <p className="text-xs text-zinc-500">
                        {[v.company, v.purpose, v.hostName && `Host: ${v.hostName}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="text-right shrink-0 text-xs text-zinc-500">
                      <p>
                        In{" "}
                        {v.acknowledgedAt.toLocaleTimeString("en-AU", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Australia/Melbourne",
                        })}
                      </p>
                      {v.signedOutAt && (
                        <p>
                          Out{" "}
                          {v.signedOutAt.toLocaleTimeString("en-AU", {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Australia/Melbourne",
                          })}
                        </p>
                      )}
                    </div>
                    {v.signatureUrl && (
                      <a
                        href={v.signatureUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Sig →
                      </a>
                    )}
                    {!v.signedOutAt && (
                      <form action={signOutVisitor.bind(null, v.id, id)}>
                        <button
                          type="submit"
                          className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        >
                          Sign out
                        </button>
                      </form>
                    )}
                    {v.signedOutAt && (
                      <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        Left
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recent */}
        {recentVisitors.length > 0 && (
          <div className="mt-8">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Recent visits (last 20)
            </h2>
            <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {recentVisitors.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">{v.visitorName}</p>
                      <p className="text-xs text-zinc-500">
                        {v.acknowledgedAt.toLocaleDateString("en-AU", { timeZone: "Australia/Melbourne" })}
                        {v.company && ` · ${v.company}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
