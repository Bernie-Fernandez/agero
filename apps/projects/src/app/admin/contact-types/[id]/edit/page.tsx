import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/auth";
import { notFound } from "next/navigation";
import { updateContactType } from "../../actions";

export default async function EditContactTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireDirector();
  const { id } = await params;
  const sp = await searchParams;

  const ct = await prisma.contactType.findUnique({ where: { id } });
  if (!ct) notFound();

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">
        Edit Contact {ct.isSubType ? "Sub-Type" : "Type"}
      </h1>

      {sp.error === "missing-name" && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          Name is required.
        </div>
      )}

      <form action={updateContactType.bind(null, id)} className="space-y-4 bg-white border border-gray-200 rounded-lg p-6">
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            defaultValue={ct.name}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Display Order</label>
          <input
            name="displayOrder"
            type="number"
            defaultValue={ct.displayOrder ?? ""}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors">
            Save Changes
          </button>
          <a href="/admin/contact-types" className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">Cancel</a>
        </div>
      </form>
    </div>
  );
}
