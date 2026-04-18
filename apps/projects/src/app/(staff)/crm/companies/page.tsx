import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import Link from "next/link";

const TYPE_LABELS: Record<string, string> = {
  SUBCONTRACTOR: "Subcontractor",
  CLIENT: "Client",
  CONSULTANT: "Consultant",
  SUPPLIER: "Supplier",
};

const TYPE_COLORS: Record<string, string> = {
  SUBCONTRACTOR: "bg-orange-100 text-orange-700",
  CLIENT: "bg-blue-100 text-blue-700",
  CONSULTANT: "bg-purple-100 text-purple-700",
  SUPPLIER: "bg-green-100 text-green-700",
};

const ABN_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  NOT_VERIFIED: "bg-gray-100 text-gray-500",
};

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; active?: string }>;
}) {
  await requireAppUser();
  const params = await searchParams;

  const q = params.q?.trim() ?? "";
  const filterType = params.type ?? "";
  const filterActive = params.active !== "false";

  const companies = await prisma.company.findMany({
    where: {
      isActive: filterActive,
      ...(filterType ? { types: { has: filterType } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { legalName: { contains: q, mode: "insensitive" } },
              { abn: { contains: q } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { companyContacts: true } },
      subcontractorProfile: { select: { approvalStatus: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Companies</h1>
          <p className="text-sm text-zinc-500 mt-1">{companies.length} result{companies.length !== 1 ? "s" : ""}</p>
        </div>
        <Link
          href="/crm/companies/new"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          + Add Company
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Search */}
        <form method="GET" className="flex-1 min-w-48">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name or ABN…"
            className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </form>

        {/* Type filter */}
        <div className="flex gap-1.5 flex-wrap">
          {["", "SUBCONTRACTOR", "CLIENT", "CONSULTANT", "SUPPLIER"].map((t) => (
            <Link
              key={t || "all"}
              href={`/crm/companies${buildQuery({ type: t, active: filterActive ? "" : "false", q })}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filterType === t
                  ? "bg-zinc-900 text-white"
                  : "bg-white border border-gray-200 text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {t ? TYPE_LABELS[t] : "All Types"}
            </Link>
          ))}
        </div>

        {/* Active toggle */}
        <Link
          href={`/crm/companies${buildQuery({ type: filterType, active: filterActive ? "false" : "", q })}`}
          className="ml-auto px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-gray-200 text-zinc-600 hover:bg-zinc-50"
        >
          Show {filterActive ? "inactive" : "active"}
        </Link>
      </div>

      {/* Table */}
      {companies.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <p className="text-sm">No companies found.</p>
          {q && (
            <p className="text-xs mt-1">
              Try clearing the search or changing filters.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Company</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Types</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">ABN</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Contacts</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Payment Terms</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company, idx) => (
                <tr
                  key={company.id}
                  className={`${idx < companies.length - 1 ? "border-b border-gray-100" : ""} hover:bg-gray-50 transition-colors ${!company.isActive ? "opacity-60" : ""}`}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/crm/companies/${company.id}`}
                      className="font-medium text-zinc-900 hover:text-blue-600"
                    >
                      {company.name}
                    </Link>
                    {company.legalName && company.legalName !== company.name && (
                      <p className="text-xs text-zinc-400 mt-0.5">{company.legalName}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {company.types.map((t) => (
                        <span
                          key={t}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[t] ?? "bg-gray-100 text-gray-600"}`}
                        >
                          {TYPE_LABELS[t] ?? t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {company.abn ? (
                      <div>
                        <span className="font-mono text-xs text-zinc-700">{formatAbn(company.abn)}</span>
                        <div className="mt-0.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${ABN_STATUS_COLORS[company.abnStatus]}`}>
                            {company.abnStatus === "ACTIVE" ? "Active" : company.abnStatus === "CANCELLED" ? "Cancelled" : "Not verified"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-zinc-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 text-xs">
                    {company._count.companyContacts}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {company.paymentTerms || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/crm/companies/${company.id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatAbn(abn: string) {
  const d = abn.replace(/\s/g, "");
  if (d.length !== 11) return abn;
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
}

function buildQuery(params: { type?: string; active?: string; q?: string }) {
  const parts: string[] = [];
  if (params.q) parts.push(`q=${encodeURIComponent(params.q)}`);
  if (params.type) parts.push(`type=${params.type}`);
  if (params.active === "false") parts.push("active=false");
  return parts.length ? `?${parts.join("&")}` : "";
}
