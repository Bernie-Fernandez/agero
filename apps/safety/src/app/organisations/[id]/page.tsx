import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, ADMIN_MANAGER_ROLES } from "@/lib/auth";
import { ComplianceBadge } from "@/components/compliance-badge";
import { calcOrgCompliance, formatDocType } from "@/lib/compliance";
import { DocumentType } from "@/generated/prisma/client";
import { DocUploadForm } from "./doc-upload-form";
import { uploadOrgDocument } from "./actions";

const ORG_DOC_TYPES = [
  DocumentType.public_liability,
  DocumentType.workers_compensation,
  DocumentType.whs_policy,
] as const;

export default async function OrgDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const appUser = await requireRole(ADMIN_MANAGER_ROLES);

  const org = await prisma.organisation.findUnique({
    where: { id },
    include: {
      documents: true,
      _count: { select: { employedWorkers: true } },
    },
  });

  if (!org) notFound();

  const { status, reasons } = calcOrgCompliance(org);

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/organisations" userRole={appUser.role} />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link href="/organisations" className="text-sm text-zinc-500 hover:text-zinc-700">
          ← Subcontractors
        </Link>

        <div className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{org.name}</h1>
            <div className="mt-1 flex items-center gap-3 text-sm text-zinc-500">
              {org.abn && <span>ABN {org.abn}</span>}
              {org.tradeCategory && <span>{org.tradeCategory}</span>}
              {org.primaryContact && <span>Contact: {org.primaryContact}</span>}
            </div>
          </div>
          <ComplianceBadge status={status} reasons={reasons} />
        </div>

        {reasons.length > 0 && (
          <ul className="mt-3 space-y-1">
            {reasons.map((r) => (
              <li key={r} className="text-sm text-amber-700 dark:text-amber-400">⚠ {r}</li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex gap-3">
          <Link
            href={`/organisations/${id}/workers`}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            Workers ({org._count.employedWorkers})
          </Link>
        </div>

        {/* Company documents */}
        <div className="mt-8">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-4">Company documents</h2>
          <div className="space-y-3">
            {ORG_DOC_TYPES.map((docType) => {
              const existing = org.documents.find((d) => d.type === docType);
              const uploadAction = uploadOrgDocument.bind(null, id, docType);
              return (
                <DocUploadForm
                  key={docType}
                  uploadAction={uploadAction}
                  label={formatDocType(docType)}
                  currentUrl={existing?.url}
                  currentExpiry={existing?.expiryDate}
                />
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
