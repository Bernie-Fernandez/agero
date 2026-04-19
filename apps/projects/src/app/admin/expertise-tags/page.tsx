import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/auth";
import Link from "next/link";
import { toggleExpertiseTagActive, deleteExpertiseTag } from "./actions";

export default async function ExpertiseTagsPage() {
  await requireDirector();

  const tags = await prisma.expertiseTag.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { _count: { select: { companies: true } } },
  });

  // Group by category
  const grouped = tags.reduce<Record<string, typeof tags>>((acc, tag) => {
    if (!acc[tag.category]) acc[tag.category] = [];
    acc[tag.category].push(tag);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Expertise Tags</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Supplier capability tags used to classify companies
          </p>
        </div>
        <Link
          href="/admin/expertise-tags/new"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          + Add Tag
        </Link>
      </div>

      {tags.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <p className="text-sm">No expertise tags yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, categoryTags]) => (
            <div key={category} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{category}</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Tag Name</th>
                    <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Companies</th>
                    <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Status</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {categoryTags.map((tag, idx) => (
                    <tr
                      key={tag.id}
                      className={`${idx < categoryTags.length - 1 ? "border-b border-gray-100" : ""} ${!tag.isActive ? "opacity-50" : ""}`}
                    >
                      <td className="px-4 py-3 font-medium text-zinc-900">{tag.name}</td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{tag._count.companies}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          tag.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          {tag.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <Link href={`/admin/expertise-tags/${tag.id}/edit`} className="text-xs text-blue-600 hover:underline">
                            Edit
                          </Link>
                          <form action={toggleExpertiseTagActive.bind(null, tag.id, !tag.isActive)}>
                            <button type="submit" className="text-xs text-zinc-500 hover:text-zinc-900">
                              {tag.isActive ? "Deactivate" : "Activate"}
                            </button>
                          </form>
                          <form action={deleteExpertiseTag.bind(null, tag.id)}>
                            <button
                              type="submit"
                              className="text-xs text-red-500 hover:text-red-700"
                              disabled={tag._count.companies > 0}
                              title={tag._count.companies > 0 ? "Cannot delete — in use by companies" : "Delete"}
                            >
                              Delete
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
