import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, ADMIN_MANAGER_ROLES } from "@/lib/auth";
import { daysUntil } from "@/lib/s3-registers";
import { signOffReview } from "./actions";
import { ReviewForm } from "./review-form";

export default async function AnnualReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ review?: string }>;
}) {
  const { review } = await searchParams;
  const user = await requireRole(ADMIN_MANAGER_ROLES);

  const templates = await prisma.wHSDocumentTemplate.findMany({
    where: { organisationId: user.organisationId },
    orderBy: [{ flaggedForReview: "desc" }, { nextReviewDate: "asc" }],
    include: { annualReviews: { orderBy: { reviewedAt: "desc" }, take: 1, select: { reviewedAt: true, pdfUrl: true, version: true } } },
  });

  if (review) {
    const template = templates.find((t) => t.id === review);
    if (!template) notFound();
    return (
      <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
        <AppNav currentPath="/admin/annual-review" userRole={user.role} />
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <Link href="/admin/annual-review" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            ← Annual Review
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Review: {template.name}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Current version v{template.currentVersion} · ISO {template.isoClauses.join(", ")}
          </p>
          <div className="mt-8">
            <ReviewForm
              templateName={template.name}
              isoClauses={template.isoClauses}
              complianceCodes={template.complianceCodes}
              submitAction={signOffReview.bind(null, template.id)}
            />
          </div>
        </main>
      </div>
    );
  }

  const dueCount = templates.filter((t) => t.flaggedForReview || daysUntil(t.nextReviewDate) <= 30).length;

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/admin/annual-review" userRole={user.role} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Annual Review Engine</h1>
        <p className="mt-1 text-sm text-zinc-500">
          WHS documentation review · ISO 45001 Clause 10.3 · version-controlled sign-off
        </p>

        {dueCount > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            {dueCount} document{dueCount !== 1 ? "s" : ""} due for review.
          </div>
        )}

        {templates.length === 0 ? (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">No WHS document templates seeded yet. Run the seed script.</p>
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            {templates.map((t, i, arr) => {
              const days = daysUntil(t.nextReviewDate);
              const due = t.flaggedForReview || days <= 30;
              const overdue = days < 0;
              const last = t.annualReviews[0];
              return (
                <div key={t.id} className={`flex items-center justify-between px-5 py-3 ${i < arr.length - 1 ? "border-b border-zinc-100 dark:border-zinc-800" : ""} ${due ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{t.name}</p>
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">v{t.currentVersion}</span>
                      {t.flaggedForReview && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">Flagged</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      ISO {t.isoClauses.join(", ")} · review due {t.nextReviewDate.toLocaleDateString("en-AU")}
                      {overdue ? ` (overdue ${Math.abs(days)}d)` : due ? ` (${days}d)` : ""}
                      {t.flaggedForReview && t.flaggedReason ? ` · ${t.flaggedReason}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {last?.pdfUrl && (
                      <a href={last.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline dark:text-blue-400">
                        Last review PDF →
                      </a>
                    )}
                    <Link
                      href={`/admin/annual-review?review=${t.id}`}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${due ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900" : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"}`}
                    >
                      Review →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
