import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import Link from "next/link";
import { CompanyForm } from "@/components/CompanyForm";
import { createCompany } from "../actions";

export default async function NewCompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAppUser();
  const params = await searchParams;

  const org = await prisma.organisation.findFirst();
  const paymentTerms = org
    ? await prisma.paymentTerm.findMany({
        where: { organisationId: org.id, isActive: true },
        orderBy: { displayOrder: "asc" },
      })
    : [];

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link
          href="/crm/companies"
          className="text-xs text-zinc-500 hover:text-zinc-800 mb-2 inline-flex items-center gap-1"
        >
          ← Companies
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900">Add Company</h1>
      </div>

      {params.error === "missing-name" && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          Company name is required.
        </div>
      )}

      <CompanyForm
        paymentTerms={paymentTerms.map((p) => ({
          id: p.id,
          name: p.name,
          isDefault: p.isDefault,
        }))}
        action={createCompany}
      />
    </div>
  );
}
