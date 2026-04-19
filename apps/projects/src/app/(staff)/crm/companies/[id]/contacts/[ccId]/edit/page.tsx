import { prisma } from "@/lib/prisma";
import { requireAppUser, canEdit } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { updateCompanyContactLink } from "../../../../actions";

export default async function EditCompanyContactPage({
  params,
}: {
  params: Promise<{ id: string; ccId: string }>;
}) {
  const user = await requireAppUser();
  if (!canEdit(user.role)) redirect("/unauthorized");

  const { id: companyId, ccId } = await params;

  const org = await prisma.organisation.findFirst({ select: { id: true } });
  if (!org) return <div>No organisation found.</div>;

  const [cc, associationLabels] = await Promise.all([
    prisma.companyContact.findUnique({
      where: { id: ccId },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        company: { select: { id: true, name: true } },
        associationLabel: true,
      },
    }),
    prisma.associationLabel.findMany({
      where: { organisationId: org.id, isActive: true, associationType: "COMPANY" },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!cc || cc.companyId !== companyId) notFound();

  const action = updateCompanyContactLink.bind(null, ccId, companyId);

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <Link href={`/crm/companies/${companyId}`} className="text-xs text-zinc-500 hover:text-zinc-800 mb-2 inline-flex items-center gap-1">
          ← {cc.company.name}
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900">Edit Contact Link</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {cc.contact.firstName} {cc.contact.lastName} at {cc.company.name}
        </p>
      </div>

      <form action={action} className="space-y-4 bg-white border border-gray-200 rounded-lg p-6">
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Position at Company</label>
          <input
            name="position"
            defaultValue={cc.position ?? ""}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Project Manager"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Association Label</label>
          <select
            name="associationLabelId"
            defaultValue={cc.associationLabelId ?? ""}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— None —</option>
            {associationLabels.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-zinc-600">Flags</label>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isPrimary"
              id="isPrimary"
              defaultChecked={cc.isPrimary}
              value="true"
              className="rounded border-gray-300"
            />
            <label htmlFor="isPrimary" className="text-sm text-zinc-700">Primary contact for this company</label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isAccountContact"
              id="isAccountContact"
              defaultChecked={cc.isAccountContact}
              value="true"
              className="rounded border-gray-300"
            />
            <label htmlFor="isAccountContact" className="text-sm text-zinc-700">Account contact (ACC)</label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isEstimatingContact"
              id="isEstimatingContact"
              defaultChecked={cc.isEstimatingContact}
              value="true"
              className="rounded border-gray-300"
            />
            <label htmlFor="isEstimatingContact" className="text-sm text-zinc-700">Estimating contact — receives tender invitations (EST)</label>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            Save Changes
          </button>
          <Link href={`/crm/companies/${companyId}`} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
