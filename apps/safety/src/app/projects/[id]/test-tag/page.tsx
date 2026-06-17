import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { testTagStatus } from "@/lib/s3-registers";
import { addTestTagEntry, retestItem, deleteTestTagEntry } from "./actions";
import { TestTagForm } from "./test-tag-form";

export default async function TestTagPage({
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

  const entries = await prisma.testTagRegister.findMany({
    where: { projectId: id },
    orderBy: { nextTestDate: "asc" },
  });

  const overdue = entries.filter((e) => testTagStatus(e.nextTestDate).status === "expired").length;

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/projects" userRole={user.role} />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link href={`/projects/${id}/readiness`} className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← {safetyProject.name}
        </Link>
        <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Test & Tag Register</h1>
            <p className="mt-1 text-sm text-zinc-500">Electrical equipment · 3-month testing cycle (AS/NZS 3760)</p>
          </div>
          <TestTagForm submitAction={addTestTagEntry.bind(null, id)} />
        </div>

        {overdue > 0 && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {overdue} item{overdue !== 1 ? "s" : ""} overdue for testing — retest before use.
          </div>
        )}

        {entries.length === 0 ? (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">No equipment recorded yet.</p>
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Owner</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Last test</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Next test</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                {entries.map((e) => {
                  const st = testTagStatus(e.nextTestDate);
                  const retest = retestItem.bind(null, id, e.id);
                  const del = deleteTestTagEntry.bind(null, id, e.id);
                  return (
                    <tr key={e.id} className={st.status === "expired" ? "bg-red-50/40 dark:bg-red-950/10" : ""}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">{e.itemName}</p>
                        <p className="text-xs text-zinc-500">
                          {e.location ?? ""}{e.tagColour ? ` · ${e.tagColour} tag` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{e.owner ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{e.lastTestDate.toLocaleDateString("en-AU")}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{e.nextTestDate.toLocaleDateString("en-AU")}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            st.status === "current"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                              : st.status === "expiring"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                          }`}
                        >
                          {st.status === "current"
                            ? "Current"
                            : st.status === "expiring"
                              ? `Due in ${st.days}d`
                              : `Overdue ${Math.abs(st.days)}d`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <form action={retest} className="flex items-center gap-1">
                            <input type="hidden" name="retestDate" value={new Date().toISOString().slice(0, 10)} />
                            <button type="submit" className="text-xs text-blue-600 hover:underline dark:text-blue-400">
                              Mark retested
                            </button>
                          </form>
                          <form action={del}>
                            <button type="submit" className="text-xs text-red-600 hover:underline dark:text-red-400">
                              Remove
                            </button>
                          </form>
                        </div>
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
