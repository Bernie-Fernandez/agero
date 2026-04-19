import { prisma } from "@/lib/prisma";
import { requireDirector } from "@/lib/auth";
import Link from "next/link";
import { toggleContactTypeActive, deleteContactType } from "./actions";

export default async function ContactTypesPage() {
  await requireDirector();

  const types = await prisma.contactType.findMany({
    orderBy: [{ isSubType: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
  });

  const contactTypes = types.filter((t) => !t.isSubType);
  const subTypes = types.filter((t) => t.isSubType);

  function Table({ rows, title }: { rows: typeof types; title: string }) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</h2>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-400">No items yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Order</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Name</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t, idx) => (
                <tr
                  key={t.id}
                  className={`${idx < rows.length - 1 ? "border-b border-gray-100" : ""} ${!t.isActive ? "opacity-50" : ""}`}
                >
                  <td className="px-4 py-3 text-zinc-400 text-xs">{t.displayOrder ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-zinc-900">{t.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {t.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Link href={`/admin/contact-types/${t.id}/edit`} className="text-xs text-blue-600 hover:underline">Edit</Link>
                      <form action={toggleContactTypeActive.bind(null, t.id, !t.isActive)}>
                        <button type="submit" className="text-xs text-zinc-500 hover:text-zinc-900">
                          {t.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                      <form action={deleteContactType.bind(null, t.id)}>
                        <button type="submit" className="text-xs text-red-500 hover:text-red-700">Delete</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Contact Types</h1>
          <p className="text-sm text-zinc-500 mt-1">Admin-managed dropdown options for contact type and sub-type fields</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/contact-types/new?subtype=false"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            + Add Type
          </Link>
          <Link
            href="/admin/contact-types/new?subtype=true"
            className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 text-zinc-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
          >
            + Add Sub-Type
          </Link>
        </div>
      </div>

      <div className="space-y-6">
        <Table rows={contactTypes} title="Contact Types" />
        <Table rows={subTypes} title="Contact Sub-Types" />
      </div>
    </div>
  );
}
