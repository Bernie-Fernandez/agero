import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { saveFirstAidChecklist } from "./actions";
import { REQUIREMENTS_ITEMS, BOX_ITEMS } from "./constants";
import { FirstAidChecklistForm } from "./first-aid-checklist-form";

const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

export default async function FirstAidPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const { new: newType } = await searchParams;
  const user = await requireRole(AGERO_ROLES);

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id },
    select: { id: true, name: true, address: true, organisationId: true, erpProjectId: true },
  });
  if (!safetyProject || safetyProject.organisationId !== user.organisationId) notFound();

  if (newType === "requirements" || newType === "box") {
    const checklistType = newType === "requirements" ? "REQUIREMENTS" : "BOX_INSPECTION";
    const items = newType === "requirements" ? REQUIREMENTS_ITEMS : BOX_ITEMS;
    return (
      <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
        <AppNav currentPath="/projects" userRole={user.role} />
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <Link
            href={`/projects/${id}/first-aid`}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            ← First Aid Management
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {newType === "requirements" ? "First Aid Requirements Checklist" : "First Aid Box Inspection"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{safetyProject.name}</p>
          <div className="mt-8">
            <FirstAidChecklistForm
              checklistType={checklistType}
              itemDescriptions={items}
              submitAction={saveFirstAidChecklist.bind(null, id, checklistType)}
            />
          </div>
        </main>
      </div>
    );
  }

  const [checklists, firstAiders] = await Promise.all([
    prisma.firstAidChecklist.findMany({
      where: { projectId: id },
      include: { conductedBy: { select: { name: true, email: true } } },
      orderBy: { conductedAt: "desc" },
    }),
    // Workers on this project with FIRST_AID credentials
    prisma.worker.findMany({
      where: { projectId: safetyProject.erpProjectId },
      include: {
        credentials: {
          where: { credentialType: "FIRST_AID" },
          orderBy: { expiryDate: "asc" },
        },
        employingOrganisation: { select: { name: true } },
      },
    }),
  ]);

  const now = new Date();
  const firstAidersWithCreds = firstAiders.filter((w) => w.credentials.length > 0);

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/projects" userRole={user.role} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link
          href={`/projects/${id}/readiness`}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          ← {safetyProject.name}
        </Link>

        <div className="mt-3">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            First Aid Management
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {safetyProject.name}
            {safetyProject.address && ` · ${safetyProject.address}`}
          </p>
        </div>

        {/* First Aider Register */}
        <div className="mt-8">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              First Aider Register
            </h2>
            <Link
              href={`/projects/${safetyProject.erpProjectId}/readiness`}
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Manage credentials →
            </Link>
          </div>

          {firstAidersWithCreds.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800/50 dark:bg-amber-950/20">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                No qualified First Aiders registered on this project
              </p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                Upload First Aid certificates via worker credential records.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {firstAidersWithCreds.map((w) => {
                  const cert = w.credentials[0];
                  const daysUntilExpiry = cert.expiryDate
                    ? Math.floor((cert.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                    : null;
                  const expiring = daysUntilExpiry !== null && daysUntilExpiry <= 60;
                  const expired = daysUntilExpiry !== null && daysUntilExpiry < 0;

                  return (
                    <div key={w.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">
                          {w.firstName} {w.lastName}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {w.employingOrganisation?.name ?? "Unknown company"}
                          {cert.credentialNumber && ` · ${cert.credentialNumber}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {cert.expiryDate ? (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              expired
                                ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                : expiring
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                  : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                            }`}
                          >
                            {expired
                              ? `Expired ${Math.abs(daysUntilExpiry!)} days ago`
                              : expiring
                                ? `Expires in ${daysUntilExpiry} days`
                                : `Expires ${cert.expiryDate.toLocaleDateString("en-AU")}`}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">No expiry recorded</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Checklists */}
        <div className="mt-8">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Checklists</h2>
            <div className="flex gap-2">
              <Link
                href={`/projects/${id}/first-aid?new=requirements`}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              >
                Requirements checklist
              </Link>
              <Link
                href={`/projects/${id}/first-aid?new=box`}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              >
                Box inspection
              </Link>
            </div>
          </div>

          {checklists.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm text-zinc-500">No checklists completed yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {checklists.map((c) => {
                const items = c.items as { description: string; compliant: boolean }[];
                const nonCompliant = items.filter((i) => !i.compliant).length;
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {c.checklistType === "REQUIREMENTS"
                          ? "First Aid Requirements"
                          : "First Aid Box Inspection"}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {c.conductedAt.toLocaleDateString("en-AU")} · {c.conductedBy.name ?? c.conductedBy.email}
                        {nonCompliant > 0 && ` · ${nonCompliant} non-compliant`}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        nonCompliant > 0
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                          : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                      }`}
                    >
                      {nonCompliant > 0 ? `${nonCompliant} issues` : "Compliant"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
