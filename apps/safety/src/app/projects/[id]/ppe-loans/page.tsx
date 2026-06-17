import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { addPpeLoan, markReturned, deletePpeLoan } from "./actions";
import { PpeLoanForm } from "./ppe-loan-form";

export default async function PpeLoanPage({
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

  const loans = await prisma.pPELoanRegister.findMany({
    where: { projectId: id },
    orderBy: [{ status: "asc" }, { loanedAt: "desc" }],
  });

  const onLoan = loans.filter((l) => l.status === "ON_LOAN").length;

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/projects" userRole={user.role} />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link href={`/projects/${id}/readiness`} className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← {safetyProject.name}
        </Link>
        <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">PPE & Equipment Loan Register</h1>
            <p className="mt-1 text-sm text-zinc-500">{onLoan} item{onLoan !== 1 ? "s" : ""} currently on loan</p>
          </div>
          <PpeLoanForm submitAction={addPpeLoan.bind(null, id)} />
        </div>

        {loans.length === 0 ? (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">No loans recorded yet.</p>
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Borrower</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Licence</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Deposit</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Loaned</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                {loans.map((l) => {
                  const returned = l.status === "RETURNED";
                  const overdue = !returned && l.dueDate && l.dueDate.getTime() < Date.now();
                  const ret = markReturned.bind(null, id, l.id);
                  const del = deletePpeLoan.bind(null, id, l.id);
                  return (
                    <tr key={l.id} className={overdue ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}>
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">{l.itemName}</td>
                      <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                        {l.borrowerName}
                        {l.company ? <span className="text-zinc-400"> · {l.company}</span> : ""}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{l.licenceNumber ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{l.deposit ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {l.loanedAt.toLocaleDateString("en-AU")}
                        {l.dueDate && (
                          <span className={overdue ? "block text-amber-600" : "block text-zinc-400"}>
                            due {l.dueDate.toLocaleDateString("en-AU")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {returned ? (
                          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                            Returned {l.returnedAt?.toLocaleDateString("en-AU")}
                          </span>
                        ) : (
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${overdue ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"}`}>
                            {overdue ? "Overdue" : "On loan"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {!returned && (
                            <form action={ret}>
                              <button type="submit" className="text-xs text-blue-600 hover:underline dark:text-blue-400">
                                Mark returned
                              </button>
                            </form>
                          )}
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
