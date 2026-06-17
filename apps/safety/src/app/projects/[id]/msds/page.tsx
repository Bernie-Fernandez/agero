import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { msdsCurrency } from "@/lib/s3-registers";
import { addMsdsEntry, deleteMsdsEntry } from "./actions";
import { MsdsForm } from "./msds-form";

export default async function MsdsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole(AGERO_ROLES);

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id },
    select: { id: true, name: true, organisationId: true },
  });
  if (!safetyProject || safetyProject.organisationId !== user.organisationId) notFound();

  const entries = await prisma.mSDSRegister.findMany({
    where: { projectId: id },
    orderBy: { productName: "asc" },
  });

  const expiredCount = entries.filter((e) => msdsCurrency(e.msdsIssueDate).status === "expired").length;

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/projects" userRole={user.role} />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link href={`/projects/${id}/readiness`} className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← {safetyProject.name}
        </Link>
        <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">MSDS Register</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Hazardous substances · 5-year MSDS currency rule enforced
            </p>
          </div>
          <MsdsForm submitAction={addMsdsEntry.bind(null, id)} />
        </div>

        {expiredCount > 0 && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {expiredCount} MSDS document{expiredCount !== 1 ? "s" : ""} {expiredCount !== 1 ? "are" : "is"} over 5 years old and must be replaced.
          </div>
        )}

        {entries.length === 0 ? (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">No substances recorded yet.</p>
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Location</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500">Hazardous</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500">DG</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">MSDS currency</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                {entries.map((e) => {
                  const cur = msdsCurrency(e.msdsIssueDate);
                  const del = deleteMsdsEntry.bind(null, id, e.id);
                  return (
                    <tr key={e.id} className={cur.status === "expired" ? "bg-red-50/40 dark:bg-red-950/10" : ""}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">{e.productName}</p>
                        {e.manufacturer && <p className="text-xs text-zinc-500">{e.manufacturer}</p>}
                        {e.msdsUrl && (
                          <a href={e.msdsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline dark:text-blue-400">
                            MSDS →
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{e.location ?? "—"}</td>
                      <td className="px-4 py-3 text-center">{e.hazardous ? "⚠" : "—"}</td>
                      <td className="px-4 py-3 text-center text-xs text-zinc-500">{e.dangerousGoods ? (e.dgClass ?? "Yes") : "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            cur.status === "current"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                              : cur.status === "expiring"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                : cur.status === "expired"
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                  : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {cur.status === "current"
                            ? "Current"
                            : cur.status === "expiring"
                              ? "Expiring"
                              : cur.status === "expired"
                                ? "Expired (>5yr)"
                                : "No date"}
                        </span>
                        {cur.expiresOn && (
                          <p className="mt-0.5 text-xs text-zinc-400">
                            valid to {cur.expiresOn.toLocaleDateString("en-AU")}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <form action={del}>
                          <button type="submit" className="text-xs text-red-600 hover:underline dark:text-red-400">
                            Remove
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
