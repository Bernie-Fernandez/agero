import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { ComplianceBadge } from "@/components/compliance-badge";
import {
  calcOrgCompliance,
  formatDocType,
  daysUntil,
  EXPIRY_WARN_DAYS,
  REQUIRED_ORG_DOCS,
} from "@/lib/compliance";
import type { RagStatus } from "@/lib/compliance";
import { DocumentType } from "@/generated/prisma/client";

const COMPANY_DOCS = [
  DocumentType.public_liability,
  DocumentType.workers_compensation,
  DocumentType.contract_works,
  DocumentType.professional_indemnity,
  DocumentType.whs_policy,
];

function getDocStatus(doc: { expiryDate: Date | null } | undefined, required: boolean): RagStatus {
  if (!doc) return required ? "red" : "amber";
  if (!doc.expiryDate) return "green";
  const days = daysUntil(doc.expiryDate);
  if (days < 0) return "red";
  if (days <= EXPIRY_WARN_DAYS) return "amber";
  return "green";
}

export default async function SubcontractorDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const appUser = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (!appUser) redirect("/onboarding");

  const org = await prisma.organisation.findUnique({
    where: { id },
    include: {
      documents: true,
      _count: { select: { employedWorkers: true } },
      subcontractorOnProjects: {
        include: {
          project: {
            include: {
              supervisors: true,
            },
          },
        },
      },
      swmsSubmissions: {
        orderBy: { versionNumber: "desc" },
      },
    },
  });

  if (!org) notFound();

  // Per-project SWMS (latest version per project)
  const swmsByProject = new Map<string, typeof org.swmsSubmissions[0]>();
  for (const s of org.swmsSubmissions) {
    if (!swmsByProject.has(s.projectId)) swmsByProject.set(s.projectId, s);
  }

  const { status: overallStatus, reasons } = calcOrgCompliance({
    documents: org.documents,
    swmsSubmissions: org.swmsSubmissions,
  });

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/subcontractors" />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link href="/subcontractors" className="text-sm text-zinc-500 hover:text-zinc-700">← Subcontractors</Link>

        {/* Company header */}
        <div className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{org.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
              {org.abn && <span>ABN {org.abn}</span>}
              {org.address && <span>{org.address}</span>}
              {org.website && (
                <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {org.website}
                </a>
              )}
              <span>{org._count.employedWorkers} workers</span>
            </div>
            {org.tradeCategories.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {org.tradeCategories.map((t) => (
                  <span key={t} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <ComplianceBadge status={overallStatus} reasons={reasons} />
        </div>

        {reasons.length > 0 && (
          <ul className="mt-3 space-y-1">
            {reasons.map((r) => (
              <li key={r} className="text-sm text-amber-700 dark:text-amber-400">⚠ {r}</li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex gap-3">
          <Link href={`/subcontractors/${id}/documents`}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            Manage documents
          </Link>
          <Link href={`/organisations/${id}/workers`}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            Workers ({org._count.employedWorkers})
          </Link>
        </div>

        {/* Company documents */}
        <div className="mt-8">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-4">Company documents</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {COMPANY_DOCS.map((docType) => {
              const doc = org.documents.find((d) => d.type === docType);
              const required = REQUIRED_ORG_DOCS.includes(docType);
              const docStatus = getDocStatus(doc ? { expiryDate: doc.expiryDate } : undefined, required);
              const days = doc?.expiryDate ? daysUntil(doc.expiryDate) : null;

              return (
                <div key={docType} className={`rounded-xl border p-4 ${
                  docStatus === "red" ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20" :
                  docStatus === "amber" ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20" :
                  "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                }`}>
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {formatDocType(docType)}
                      {!required && <span className="ml-1 text-xs font-normal text-zinc-400">(optional)</span>}
                    </p>
                    <ComplianceBadge status={docStatus} />
                  </div>
                  {doc ? (
                    <div className="mt-2 space-y-1">
                      <a href={doc.url} target="_blank" rel="noopener noreferrer"
                        className="block text-xs text-blue-600 hover:underline">View document →</a>
                      {doc.expiryDate && (
                        <p className="text-xs text-zinc-500">
                          Expires {new Date(doc.expiryDate).toLocaleDateString("en-AU")}
                          {days !== null && (
                            <span className={`ml-1 ${days < 0 ? "text-red-600" : days <= 7 ? "text-red-500" : days <= 30 ? "text-amber-600" : "text-zinc-400"}`}>
                              {days < 0 ? `(expired ${Math.abs(days)}d ago)` : `(${days}d)`}
                            </span>
                          )}
                          {doc.aiExtractedExpiry && <span className="ml-1 text-xs text-blue-400" title="AI extracted">AI</span>}
                        </p>
                      )}
                      {doc.coverageAmount && (
                        <p className="text-xs text-zinc-500">Coverage: {doc.coverageAmount}</p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-red-500">Not uploaded</p>
                  )}
                  <Link href={`/subcontractors/${id}/documents`}
                    className="mt-3 block text-xs text-zinc-400 hover:text-zinc-600">
                    {doc ? "Replace →" : "Upload →"}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        {/* Projects */}
        {org.subcontractorOnProjects.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-4">Projects</h2>
            <div className="space-y-3">
              {org.subcontractorOnProjects.map(({ project }) => {
                const swms = swmsByProject.get(project.id);
                const hasSupervisor = project.supervisors.some((s) => s.organisationId === id);

                return (
                  <div key={project.id} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <div>
                      <Link href={`/projects/${project.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
                        {project.name}
                      </Link>
                      {project.address && <p className="text-xs text-zinc-500">{project.address}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs ${hasSupervisor ? "text-green-600" : "text-zinc-400"}`}>
                        {hasSupervisor ? "✓ Supervisor" : "No supervisor"}
                      </span>
                      {swms ? (
                        <Link href={`/projects/${project.id}/subcontractors/${id}/swms`}>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            swms.status === "approved" ? "bg-green-100 text-green-700" :
                            swms.status === "rejected" ? "bg-red-100 text-red-700" :
                            "bg-amber-100 text-amber-700"
                          }`}>
                            SWMS: {swms.status === "approved" ? "Approved" : swms.status === "rejected" ? "Rejected" : "Pending"}
                          </span>
                        </Link>
                      ) : (
                        <Link href={`/projects/${project.id}/subcontractors/${id}/swms`}
                          className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-200">
                          SWMS: None →
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
