import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, ADMIN_MANAGER_ROLES } from "@/lib/auth";
import { buildManagementReview } from "@/lib/management-review";

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 3);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

const TONE: Record<string, string> = {
  good: "text-green-600 dark:text-green-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
  neutral: "text-zinc-900 dark:text-zinc-50",
};

export default async function ManagementReviewSummaryPage({
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

  const { metrics } = await buildManagementReview(user.organisationId, from, to);

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/admin/management-review-summary" userRole={user.role} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 print:py-4">
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 print:hidden">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Management Review — Safety Summary</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {org?.name} · IMS management review input · {from.toLocaleDateString("en-AU")} – {new Date(toStr).toLocaleDateString("en-AU")}
        </p>

        <form method="get" className="mt-6 flex items-end gap-3 flex-wrap rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 print:hidden">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">From</label>
            <input name="from" type="date" defaultValue={fromStr} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">To</label>
            <input name="to" type="date" defaultValue={toStr} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
          </div>
          <button type="submit" className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            Update period
          </button>
        </form>

        <div className="mt-6 grid gap-3 grid-cols-2 lg:grid-cols-4">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className={`text-2xl font-semibold ${TONE[m.tone]}`}>{m.value}</p>
              <p className="mt-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">{m.label}</p>
              {m.sublabel && <p className="mt-0.5 text-xs text-zinc-400">{m.sublabel}</p>}
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs text-zinc-400">
          Pull this summary for the IMS management review agenda (ISO 45001 Clause 9.3). Use your browser&apos;s print
          function to export to PDF.
        </p>
      </main>
    </div>
  );
}
