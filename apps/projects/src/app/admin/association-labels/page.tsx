import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/auth";
import Link from "next/link";
import { toggleAssociationLabelActive, deleteAssociationLabel, seedDefaultAssociationLabels } from "./actions";
import { ConfirmForm } from "@/components/ConfirmForm";

const TYPE_LABELS: Record<string, string> = {
  COMPANY: "Company",
  PROJECT: "Project",
  CONTACT: "Contact",
};
const TYPE_COLORS: Record<string, string> = {
  COMPANY: "bg-blue-100 text-blue-700",
  PROJECT: "bg-purple-100 text-purple-700",
  CONTACT: "bg-green-100 text-green-700",
};

export default async function AssociationLabelsPage() {
  await requireDirector();
  const org = await prisma.organisation.findFirst({ select: { id: true } });
  if (!org) return <div>No organisation found.</div>;

  const labels = await prisma.associationLabel.findMany({
    where: { organisationId: org.id },
    orderBy: [{ associationType: "asc" }, { name: "asc" }],
  });

  const grouped: Record<string, typeof labels> = { COMPANY: [], PROJECT: [], CONTACT: [] };
  for (const l of labels) {
    if (grouped[l.associationType]) grouped[l.associationType].push(l);
  }

  const hasLabels = labels.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Association Labels</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Labels used to describe how a contact relates to a company, project, or another contact.
          </p>
        </div>
        <div className="flex gap-2">
          {!hasLabels && (
            <form action={seedDefaultAssociationLabels}>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-gray-200 rounded-md hover:bg-zinc-50 transition-colors"
              >
                Seed Defaults
              </button>
            </form>
          )}
          <Link
            href="/admin/association-labels/new"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            + Add Label
          </Link>
        </div>
      </div>

      {!hasLabels ? (
        <div className="text-center py-16 text-zinc-400">
          <p className="text-sm">No association labels yet.</p>
          <p className="text-xs mt-1">Click "Seed Defaults" to load the standard label set.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {(["COMPANY", "PROJECT", "CONTACT"] as const).map((type) => (
            <div key={type}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                {TYPE_LABELS[type]} Labels
              </h2>
              {grouped[type].length === 0 ? (
                <p className="text-sm text-zinc-400 mb-2">None.</p>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Label</th>
                        <th className="px-4 py-2.5 font-medium text-zinc-500 text-xs">Type</th>
                        <th className="px-4 py-2.5 font-medium text-zinc-500 text-xs">Status</th>
                        <th className="px-4 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {grouped[type].map((label, idx) => (
                        <tr key={label.id} className={idx < grouped[type].length - 1 ? "border-b border-gray-100" : ""}>
                          <td className="px-4 py-2.5 text-zinc-800 font-medium">{label.name}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[label.associationType]}`}>
                              {TYPE_LABELS[label.associationType]}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <ConfirmForm
                              action={toggleAssociationLabelActive.bind(null, label.id, !label.isActive)}
                              message={label.isActive ? "Deactivate this label?" : "Reactivate this label?"}
                            >
                              <button type="submit" className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer ${label.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                {label.isActive ? "Active" : "Inactive"}
                              </button>
                            </ConfirmForm>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center gap-3 justify-end">
                              <Link href={`/admin/association-labels/${label.id}/edit`} className="text-xs text-blue-600 hover:underline">Edit</Link>
                              <ConfirmForm
                                action={deleteAssociationLabel.bind(null, label.id)}
                                message={`Delete "${label.name}"? This will remove the label from all linked company contacts.`}
                              >
                                <button type="submit" className="text-xs text-red-500 hover:text-red-700">Delete</button>
                              </ConfirmForm>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
