import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/auth";
import { notFound } from "next/navigation";
import { updateAssociationLabel } from "../../actions";

const TYPE_LABELS: Record<string, string> = {
  COMPANY: "Company",
  PROJECT: "Project",
  CONTACT: "Contact",
};

export default async function EditAssociationLabelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireDirector();
  const { id } = await params;
  const sp = await searchParams;

  const label = await prisma.associationLabel.findUnique({ where: { id } });
  if (!label) notFound();

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">Edit Association Label</h1>

      {sp.error === "missing-name" && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">Name is required.</div>
      )}

      <form action={updateAssociationLabel.bind(null, id)} className="space-y-4 bg-white border border-gray-200 rounded-lg p-6">
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Association Type</label>
          <p className="text-sm text-zinc-700 px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
            {TYPE_LABELS[label.associationType] ?? label.associationType}
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">
            Label Name <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            defaultValue={label.name}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors">
            Save Changes
          </button>
          <a href="/admin/association-labels" className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">Cancel</a>
        </div>
      </form>
    </div>
  );
}
