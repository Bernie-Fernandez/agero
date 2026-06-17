import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, ADMIN_MANAGER_ROLES } from "@/lib/auth";
import { buildAuditEvidence } from "@/lib/audit-evidence";

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setFullYear(from.getFullYear() - 1);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default async function AuditEvidencePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await requireRole(ADMIN_MANAGER_ROLES);
  const sp = await searchParams;
  const def = defaultRange();
  const fromStr = sp.from ?? def.from;
  const toStr = sp.to ?? def.to;

  const org = await prisma.organisation.findUnique({
    where: { id: user.organisationId },
    select: { name: true },
  });

  const from = new Date(fromStr);
  const to = new Date(toStr);
  to.setHours(23, 59, 59, 999);

  const { sections, consultationEvents, totalRecords } = await buildAuditEvidence(user.organisationId, from, to);

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/admin/audit-evidence" userRole={user.role} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">ISO 45001 Audit Evidence Package</h1>
        <p className="mt-1 text-sm text-zinc-500">{org?.name} · all records by ISO clause for the selected period</p>

        <form method="get" className="mt-6 flex items-end gap-3 flex-wrap rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">From</label>
            <input name="from" type="date" defaultValue={fromStr} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">To</label>
            <input name="to" type="date" defaultValue={toStr} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
          </div>
          <button type="submit" className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            Update
          </button>
          <a
            href={`/admin/audit-evidence/export?from=${fromStr}&to=${toStr}`}
            className="ml-auto rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Download PDF →
          </a>
        </form>

        <p className="mt-4 text-sm text-zinc-500">{totalRecords} records · {consultationEvents.length} consultation events</p>

        <div className="mt-4 space-y-4">
          {sections.map((s) => (
            <div key={s.clause} className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Clause {s.clause} — {s.requirement}
                </p>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.records.length > 0 ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                  {s.records.length} record{s.records.length !== 1 ? "s" : ""}
                </span>
              </div>
              {s.records.length > 0 && (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {s.records.slice(0, 8).map((r, i) => (
                    <li key={i} className="flex items-center justify-between px-5 py-2 text-xs">
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {r.form}
                        {r.detail ? <span className="text-zinc-400"> · {r.detail}</span> : ""}
                      </span>
                      <span className="text-zinc-400">{r.signatory} · {r.date}</span>
                    </li>
                  ))}
                  {s.records.length > 8 && (
                    <li className="px-5 py-2 text-xs text-zinc-400">+ {s.records.length - 8} more in PDF</li>
                  )}
                </ul>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
