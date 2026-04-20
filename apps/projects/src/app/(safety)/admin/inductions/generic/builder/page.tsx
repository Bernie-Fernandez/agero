import Link from "next/link";
import { prisma } from "@/lib/safety/prisma";
import { AppNav } from "@/components/safety/safety-nav";
import { requireRole, ADMIN_MANAGER_ROLES } from "@/lib/safety/auth";
import { InductionBuilder } from "@/app/(safety)/projects/[id]/induction/induction-builder";
import { saveGenericInduction } from "./actions";

type Question = {
  question: string;
  options: string[];
  correctAnswers?: number[];
  correctAnswer?: number;
};

export default async function GenericInductionBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const appUser = await requireRole(ADMIN_MANAGER_ROLES);

  const existing = await prisma.inductionTemplate.findFirst({
    where: { type: "generic", isActive: true },
    orderBy: { version: "desc" },
  });

  const completionCount = existing
    ? await prisma.inductionCompletion.count({
        where: { templateId: existing.id, passed: true },
      })
    : 0;

  const allVersions = await prisma.inductionTemplate.findMany({
    where: { type: "generic" },
    orderBy: { version: "desc" },
    select: { id: true, version: true, isActive: true, title: true, createdAt: true },
  });

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/admin/inductions" userRole={appUser.role} />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← Dashboard
        </Link>
        <div className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Generic induction builder
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Applies to all workers across all projects. Workers complete this once per year.
              {existing && (
                <span className="ml-2 font-medium text-zinc-600 dark:text-zinc-300">
                  Active: v{existing.version} · {completionCount} worker{completionCount !== 1 ? "s" : ""} passed
                </span>
              )}
            </p>
          </div>
        </div>

        {saved && (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
            Induction saved as new version. Workers who completed the previous version will need to redo it.
          </div>
        )}

        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <InductionBuilder
            saveAction={saveGenericInduction}
            initialTitle={existing?.title}
            initialQuestions={
              existing
                ? (existing.questions as Question[])
                : undefined
            }
            initialVideoUrl={existing?.videoUrl ?? undefined}
          />
        </div>

        {allVersions.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Version history</h2>
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Version</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Created</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {allVersions.map((v) => (
                    <tr key={v.id}>
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">v{v.version}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{v.title}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {new Date(v.createdAt).toLocaleDateString("en-AU")}
                      </td>
                      <td className="px-4 py-3">
                        {v.isActive ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                            Active
                          </span>
                        ) : (
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
                            Superseded
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
