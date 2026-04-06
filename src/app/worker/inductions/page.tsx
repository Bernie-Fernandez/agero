import { redirect } from "next/navigation";
import Link from "next/link";
import { getWorkerSession } from "@/lib/worker-auth";
import { prisma } from "@/lib/prisma";
import { DeclarationViewer } from "./declaration-viewer";

export default async function WorkerInductionsPage() {
  const session = await getWorkerSession();
  if (!session) redirect("/worker/login");

  const { workerAccount } = session;

  // All Worker records for this mobile
  const workers = await prisma.worker.findMany({
    where: { mobile: workerAccount.mobile },
    select: { id: true, project: { select: { name: true } } },
  });

  const workerIds = workers.map((w) => w.id);

  const completions = await prisma.inductionCompletion.findMany({
    where: { workerId: { in: workerIds } },
    include: {
      template: { select: { title: true, type: true, version: true } },
      worker: { select: { project: { select: { name: true } } } },
    },
    orderBy: { signedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Induction history
        </h1>
        <Link
          href="/worker/dashboard"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          ← Dashboard
        </Link>
      </div>

      {completions.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No inductions completed yet.</p>
      ) : (
        <ul className="space-y-3">
          {completions.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {c.template.title}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {c.template.type === "generic"
                      ? "Generic induction"
                      : `Site-specific · ${c.worker.project.name}`}
                    {" · "}v{c.template.version}
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    {new Date(c.signedAt).toLocaleDateString("en-AU", {
                      dateStyle: "medium",
                    })}
                    {c.score !== null && ` · Score: ${c.score}%`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {c.passed ? (
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
                      Passed
                    </span>
                  ) : (
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
                      Failed
                    </span>
                  )}
                  {c.declarationSignedAt && c.declarationData && (
                    <DeclarationViewer
                      signedAt={c.declarationSignedAt.toISOString()}
                      data={c.declarationData as Record<string, unknown>}
                    />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
