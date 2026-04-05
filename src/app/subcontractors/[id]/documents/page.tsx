import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/generated/prisma/client";
import { AppNav } from "@/components/app-nav";
import { DocumentType } from "@/generated/prisma/client";
import { formatDocType, daysUntil, EXPIRY_WARN_DAYS } from "@/lib/compliance";
import type { RagStatus } from "@/lib/compliance";
import { DocUploadCard } from "./doc-upload-card";
import { uploadCompanyDocument } from "./actions";

const COMPANY_DOCS: { type: DocumentType; showCoverage?: boolean }[] = [
  { type: DocumentType.public_liability, showCoverage: true },
  { type: DocumentType.workers_compensation },
  { type: DocumentType.contract_works },
  { type: DocumentType.professional_indemnity },
  { type: DocumentType.whs_policy },
];

function docStatus(doc: { expiryDate: Date | null } | undefined, required: boolean): { status: RagStatus; reasons: string[] } {
  if (!doc) return { status: required ? "red" : "amber", reasons: [required ? "Not uploaded" : "Not uploaded (optional)"] };
  if (!doc.expiryDate) return { status: "green", reasons: [] };
  const days = daysUntil(doc.expiryDate);
  if (days < 0) return { status: "red", reasons: [`Expired ${Math.abs(days)}d ago`] };
  if (days <= EXPIRY_WARN_DAYS) return { status: "amber", reasons: [`Expires in ${days}d`] };
  return { status: "green", reasons: [] };
}

export default async function DocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { id } = await params;
  const { welcome } = await searchParams;

  const { userId } = await auth();
  let appUserRole: UserRole | undefined;
  // Allow unauthenticated access for subcontractors coming from registration link
  if (userId) {
    const appUser = await prisma.user.findUnique({ where: { clerkUserId: userId } });
    if (!appUser) redirect("/onboarding");
    appUserRole = appUser.role;
  }

  const org = await prisma.organisation.findUnique({
    where: { id },
    include: { documents: true },
  });
  if (!org) notFound();

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      {userId ? <AppNav currentPath="/subcontractors" userRole={appUserRole} /> : (
        <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Agero Safety</span>
          </div>
        </header>
      )}
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {userId && (
          <Link href={`/subcontractors/${id}`} className="text-sm text-zinc-500 hover:text-zinc-700">← {org.name}</Link>
        )}

        {welcome === "1" && (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-5 py-4 dark:border-green-800 dark:bg-green-950/30">
            <p className="font-medium text-green-800 dark:text-green-300">Welcome to Agero!</p>
            <p className="mt-1 text-sm text-green-700 dark:text-green-400">
              Registration complete. Please upload your compliance documents below to become fully active on the platform.
            </p>
          </div>
        )}

        <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Compliance documents — {org.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Upload your company insurance and compliance documents. Expiry dates are automatically extracted where possible.</p>

        <div className="mt-6 space-y-4">
          {COMPANY_DOCS.map(({ type, showCoverage }) => {
            const existing = org.documents.find((d) => d.type === type);
            const required = type !== DocumentType.professional_indemnity;
            const { status, reasons } = docStatus(existing ? { expiryDate: existing.expiryDate } : undefined, required);
            const uploadAction = uploadCompanyDocument.bind(null, id, type);

            return (
              <DocUploadCard
                key={type}
                label={formatDocType(type) + (!required ? " (optional)" : "")}
                docType={type}
                status={status}
                reasons={reasons}
                currentUrl={existing?.url}
                currentExpiry={existing?.expiryDate}
                daysUntilExpiry={existing?.expiryDate ? daysUntil(existing.expiryDate) : null}
                aiExtracted={existing?.aiExtractedExpiry}
                coverageAmount={existing?.coverageAmount}
                showCoverage={showCoverage}
                uploadAction={uploadAction}
              />
            );
          })}
        </div>
      </main>
    </div>
  );
}
