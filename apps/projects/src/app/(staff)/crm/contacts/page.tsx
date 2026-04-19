import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import Link from "next/link";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; companyId?: string; type?: string }>;
}) {
  await requireAppUser();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const filterCompanyId = params.companyId ?? "";
  const filterType = params.type ?? "";

  const org = await prisma.organisation.findFirst({ select: { id: true } });
  if (!org) return <div>No organisation found.</div>;

  const [companies, contacts] = await Promise.all([
    prisma.company.findMany({
      where: { organisationId: org.id, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.contact.findMany({
      where: {
        organisationId: org.id,
        ...(filterCompanyId ? { companyContacts: { some: { companyId: filterCompanyId } } } : {}),
        ...(filterType ? { contactType: filterType } : {}),
        ...(q
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { mobile: { contains: q } },
              ],
            }
          : {}),
      },
      include: {
        companyContacts: {
          where: { isPrimary: true },
          include: { company: { select: { id: true, name: true } } },
          take: 1,
        },
        contactOwner: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Contacts</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {contacts.length} result{contacts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/crm/contacts/new"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          + Add Contact
        </Link>
      </div>

      {/* Filters */}
      <form method="GET" className="flex gap-2 flex-wrap mb-4">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name, email or mobile…"
          className="flex-1 min-w-48 border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          name="companyId"
          defaultValue={filterCompanyId}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-4 py-1.5 bg-zinc-100 text-zinc-700 text-sm font-medium rounded-md hover:bg-zinc-200 transition-colors"
        >
          Filter
        </button>
        {(q || filterCompanyId || filterType) && (
          <Link
            href="/crm/contacts"
            className="px-4 py-1.5 text-zinc-500 text-sm hover:text-zinc-800"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Table */}
      {contacts.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <p className="text-sm">No contacts found.</p>
          {(q || filterCompanyId) && (
            <p className="text-xs mt-1">Try clearing the search or changing filters.</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Name</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Job Title</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Company</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Email</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Mobile</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Owner</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact, idx) => {
                const primaryCompany = contact.companyContacts[0]?.company;
                return (
                  <tr
                    key={contact.id}
                    className={`${idx < contacts.length - 1 ? "border-b border-gray-100" : ""} hover:bg-gray-50 transition-colors ${!contact.isActive ? "opacity-60" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/crm/contacts/${contact.id}`}
                        className="font-medium text-zinc-900 hover:text-blue-600"
                      >
                        {contact.firstName} {contact.lastName}
                      </Link>
                      {contact.contactType && (
                        <p className="text-xs text-zinc-400 mt-0.5">{contact.contactType}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 text-xs">{contact.jobTitle || "—"}</td>
                    <td className="px-4 py-3 text-xs">
                      {primaryCompany ? (
                        <Link
                          href={`/crm/companies/${primaryCompany.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {primaryCompany.name}
                        </Link>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 text-xs">{contact.email || "—"}</td>
                    <td className="px-4 py-3 text-zinc-600 text-xs">{contact.mobile || "—"}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {contact.contactOwner
                        ? `${contact.contactOwner.firstName} ${contact.contactOwner.lastName}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/crm/contacts/${contact.id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
