import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole } from "@/lib/auth";
import { HRW_CLASSIFICATIONS } from "@/app/projects/[id]/pre-start/constants";
import { seedDefaultTemplates, archiveTemplate, restoreTemplate } from "./actions";
import { TemplateForm } from "./template-form";

const RISK_COLOURS: Record<string, string> = {
  Low: "bg-green-100 text-green-700",
  Medium: "bg-amber-100 text-amber-700",
  High: "bg-orange-100 text-orange-700",
  Critical: "bg-red-100 text-red-700",
};

export default async function ComplexityTemplatesPage() {
  const user = await requireRole(["admin"]);

  const templates = await prisma.complexityTemplate.findMany({
    where: { organisationId: user.organisationId },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }],
  });

  const active = templates.filter((t) => t.isActive);
  const archived = templates.filter((t) => !t.isActive);

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/admin" userRole={user.role} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← Admin
        </Link>

        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Complexity Templates
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Pre-defined project complexity items available in the Pre-Start Risk Assessment form.
              These templates appear as quick-add options and link to HRW classifications.
            </p>
          </div>
          {templates.length === 0 && (
            <form action={seedDefaultTemplates}>
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Seed defaults
              </button>
            </form>
          )}
        </div>

        {/* Active templates */}
        <section className="mt-8">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
            Active templates ({active.length})
          </h2>
          {active.length === 0 ? (
            <p className="text-sm text-zinc-500">No active templates. Add one below or seed the defaults.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                    <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Template name</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-medium text-zinc-500 sm:table-cell">Risk</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-medium text-zinc-500 sm:table-cell">HRW link</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {active.map((t) => {
                    const hrw = HRW_CLASSIFICATIONS.find((h) => h.id === t.hrwFlag);
                    return (
                      <tr key={t.id}>
                        <td className="px-5 py-3 text-xs text-zinc-400">{t.sortOrder}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-zinc-900 dark:text-zinc-50">{t.name}</p>
                          <p className="mt-0.5 text-xs text-zinc-500 line-clamp-1">{t.safetyPlanning}</p>
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RISK_COLOURS[t.riskLevel] ?? "bg-zinc-100 text-zinc-500"}`}>
                            {t.riskLevel}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-zinc-500 sm:table-cell">
                          {hrw ? hrw.label : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <form action={archiveTemplate.bind(null, t.id)}>
                            <button type="submit" className="text-xs text-zinc-400 hover:text-red-600">
                              Archive
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
        </section>

        {/* Add new template */}
        <section className="mt-8">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Add template</h2>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <TemplateForm />
          </div>
        </section>

        {/* Archived templates */}
        {archived.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-medium text-zinc-500 mb-3">Archived ({archived.length})</h2>
            <div className="space-y-2">
              {archived.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <div>
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{t.name}</p>
                    <p className="text-xs text-zinc-400">{t.riskLevel}</p>
                  </div>
                  <form action={restoreTemplate.bind(null, t.id)}>
                    <button type="submit" className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
                      Restore
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
