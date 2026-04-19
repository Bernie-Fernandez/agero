import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompanyForm } from "@/components/CompanyForm";
import { updateCompany } from "../../actions";

export default async function EditCompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAppUser();
  const { id } = await params;
  const sp = await searchParams;

  const [company, paymentTerms, expertiseTags] = await Promise.all([
    prisma.company.findUnique({
      where: { id },
      include: {
        expertiseTags: { select: { expertiseTagId: true } },
      },
    }),
    prisma.paymentTerm.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.expertiseTag.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
  ]);

  if (!company) notFound();

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/crm/companies/${id}`}
          className="text-xs text-zinc-500 hover:text-zinc-800 mb-2 inline-flex items-center gap-1"
        >
          ← {company.name}
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900">Edit Company</h1>
      </div>

      {sp.error === "missing-name" && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          Company name is required.
        </div>
      )}

      <CompanyForm
        company={{
          id: company.id,
          name: company.name,
          legalName: company.legalName,
          types: company.types,
          abn: company.abn,
          abnStatus: company.abnStatus,
          abnRegisteredName: company.abnRegisteredName,
          abnGstRegistered: company.abnGstRegistered,
          asicStatus: company.asicStatus,
          website: company.website,
          phoneMain: company.phoneMain,
          emailGeneral: company.emailGeneral,
          addressStreet: company.addressStreet,
          addressSuburb: company.addressSuburb,
          addressState: company.addressState,
          addressPostcode: company.addressPostcode,
          postalSameAsStreet: company.postalSameAsStreet,
          postalStreet: company.postalStreet,
          postalSuburb: company.postalSuburb,
          postalState: company.postalState,
          postalPostcode: company.postalPostcode,
          paymentTerms: company.paymentTerms,
          isActive: company.isActive,
          tier: company.tier,
          costLevel: company.costLevel,
          performanceRating: company.performanceRating,
          isPreferred: company.isPreferred,
          tempLabour: company.tempLabour,
          expertiseTagIds: company.expertiseTags.map((et) => et.expertiseTagId),
        }}
        paymentTerms={paymentTerms.map((p) => ({
          id: p.id,
          name: p.name,
          isDefault: p.isDefault,
        }))}
        expertiseTags={expertiseTags.map((t) => ({
          id: t.id,
          name: t.name,
          category: t.category,
        }))}
        action={updateCompany.bind(null, id)}
      />
    </div>
  );
}
