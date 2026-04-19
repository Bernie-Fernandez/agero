import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/auth";
import { notFound } from "next/navigation";
import { updateExpertiseTag } from "../../actions";

export default async function EditExpertiseTagPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireDirector();
  const { id } = await params;
  const sp = await searchParams;

  const tag = await prisma.expertiseTag.findUnique({ where: { id } });
  if (!tag) notFound();

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">Edit Expertise Tag</h1>

      {sp.error === "missing-fields" && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          Name and category are required.
        </div>
      )}

      <form action={updateExpertiseTag.bind(null, id)} className="space-y-4 bg-white border border-gray-200 rounded-lg p-6">
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">
            Tag Name <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            defaultValue={tag.name}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">
            Category <span className="text-red-500">*</span>
          </label>
          <input
            name="category"
            defaultValue={tag.category}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            Save Changes
          </button>
          <a href="/admin/expertise-tags" className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
