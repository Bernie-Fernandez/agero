import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateContact } from "../../actions";

export default async function EditContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAppUser();
  const { id } = await params;
  const sp = await searchParams;

  const org = await prisma.organisation.findFirst({ select: { id: true } });
  if (!org) return <div>No organisation found.</div>;

  const [contact, users, contactTypes, contactSubTypes] = await Promise.all([
    prisma.contact.findUnique({ where: { id } }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.contactType.findMany({
      where: { organisationId: org.id, isActive: true, isSubType: false },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.contactType.findMany({
      where: { organisationId: org.id, isActive: true, isSubType: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);

  if (!contact) notFound();

  const action = updateContact.bind(null, id);

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href={`/crm/contacts/${id}`} className="text-xs text-zinc-500 hover:text-zinc-800 mb-2 inline-flex items-center gap-1">
          ← {contact.firstName} {contact.lastName}
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900">Edit Contact</h1>
      </div>

      {sp.error === "missing-name" && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          First name and last name are required.
        </div>
      )}

      <form action={action} className="space-y-6">
        {/* Name */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Name</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                name="firstName"
                defaultValue={contact.firstName}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                name="lastName"
                defaultValue={contact.lastName}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Job Title</label>
            <input
              name="jobTitle"
              defaultValue={contact.jobTitle ?? ""}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Contact Details */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Contact Details</h2>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Email</label>
            <input
              name="email"
              type="email"
              defaultValue={contact.email ?? ""}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Mobile</label>
              <input
                name="mobile"
                type="tel"
                defaultValue={contact.mobile ?? ""}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Phone (DDI)</label>
              <input
                name="phoneDdi"
                type="tel"
                defaultValue={contact.phoneDdi ?? ""}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Preferred Contact Method</label>
            <select
              name="preferredContactMethod"
              defaultValue={contact.preferredContactMethod ?? ""}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select —</option>
              <option value="Email">Email</option>
              <option value="Mobile">Mobile</option>
              <option value="Phone">Phone</option>
              <option value="SMS">SMS</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-zinc-600">Do Not Call</label>
            <select
              name="doNotCall"
              defaultValue={contact.doNotCall ? "true" : "false"}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
        </div>

        {/* Classification */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Classification</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Contact Type</label>
              <select
                name="contactType"
                defaultValue={contact.contactType ?? ""}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Select —</option>
                {contactTypes.map((ct) => (
                  <option key={ct.id} value={ct.name}>{ct.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Contact Sub-Type</label>
              <select
                name="contactSubType"
                defaultValue={contact.contactSubType ?? ""}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Select —</option>
                {contactSubTypes.map((ct) => (
                  <option key={ct.id} value={ct.name}>{ct.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Location</label>
            <input
              name="contactLocation"
              defaultValue={contact.contactLocation ?? ""}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Social */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Social</h2>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">LinkedIn URL</label>
            <input
              name="linkedinUrl"
              type="url"
              defaultValue={contact.linkedinUrl ?? ""}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Instagram URL</label>
            <input
              name="instagramUrl"
              type="url"
              defaultValue={contact.instagramUrl ?? ""}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Mailing Address</label>
            <textarea
              name="mailingAddress"
              rows={2}
              defaultValue={contact.mailingAddress ?? ""}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Ownership */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Ownership &amp; Compliance</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Contact Owner</label>
              <select
                name="contactOwnerId"
                defaultValue={contact.contactOwnerId ?? ""}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Unassigned —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Relationship Strength</label>
              <select
                name="contactOwnerStrength"
                defaultValue={contact.contactOwnerStrength ?? ""}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— None —</option>
                <option value="BRONZE">Bronze</option>
                <option value="SILVER">Silver</option>
                <option value="GOLD">Gold</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Legal Basis for Data</label>
            <select
              name="legalBasisForData"
              defaultValue={contact.legalBasisForData ?? ""}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select —</option>
              <option value="Legitimate Interest">Legitimate Interest</option>
              <option value="Consent">Consent</option>
              <option value="Contract">Contract</option>
              <option value="Legal Obligation">Legal Obligation</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-zinc-600">Status</label>
            <select
              name="isActive"
              defaultValue={contact.isActive ? "true" : "false"}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            Save Changes
          </button>
          <Link href={`/crm/contacts/${id}`} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
