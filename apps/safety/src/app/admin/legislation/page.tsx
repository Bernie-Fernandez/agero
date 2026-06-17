import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, ADMIN_MANAGER_ROLES } from "@/lib/auth";
import { updateLegislation } from "./actions";
import { LegislationEditForm } from "./edit-form";

function toDateStr(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export default async function LegislationPage() {
  const user = await requireRole(ADMIN_MANAGER_ROLES);

  const items = await prisma.legislationRegister.findMany({
    where: { organisationId: user.organisationId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/admin/legislation" userRole={user.role} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Legislation Register</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Applicable Victorian legislation, standards & compliance codes · current as of June 2026
        </p>

        {items.length === 0 ? (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">Legislation register not seeded yet. Run the seed script.</p>
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {items.map((leg) => (
              <LegislationEditForm
                key={leg.id}
                leg={{
                  id: leg.id,
                  title: leg.title,
                  reference: leg.reference,
                  category: leg.category,
                  version: leg.version,
                  effectiveDate: toDateStr(leg.effectiveDate),
                  lastReviewedDate: toDateStr(leg.lastReviewedDate),
                  affectsTemplateKeys: leg.affectsTemplateKeys,
                  notes: leg.notes,
                  updatedByName: leg.updatedByName,
                }}
                submitAction={updateLegislation.bind(null, leg.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
