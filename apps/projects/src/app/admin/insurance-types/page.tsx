import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { toggleInsuranceTypeActive, deleteInsuranceType } from "./actions";

export default async function InsuranceTypesPage() {
  const types = await prisma.insurancePolicyType.findMany({
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Insurance Types</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {types.length} types &mdash; PL and Workers Compensation are mandatory
          </p>
        </div>
        <Link
          href="/admin/insurance-types/new"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          + Add Type
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs">Order</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs">Name</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs">Description</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs">Mandatory</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {types.map((t, idx) => (
              <tr
                key={t.id}
                className={`${idx < types.length - 1 ? "border-b border-gray-100" : ""} ${!t.isActive ? "opacity-50" : ""}`}
              >
                <td className="px-4 py-3 text-zinc-400 text-xs">{t.displayOrder ?? "—"}</td>
                <td className="px-4 py-3 font-medium text-zinc-900">{t.name}</td>
                <td className="px-4 py-3 text-zinc-500 text-xs max-w-xs truncate">{t.description ?? "—"}</td>
                <td className="px-4 py-3">
                  {t.isMandatory ? (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                      Mandatory
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-400">Optional</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    t.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {t.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <Link href={`/admin/insurance-types/${t.id}/edit`} className="text-xs text-blue-600 hover:underline">
                      Edit
                    </Link>
                    <form action={toggleInsuranceTypeActive.bind(null, t.id, !t.isActive)}>
                      <button type="submit" className="text-xs text-zinc-500 hover:text-zinc-900">
                        {t.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </form>
                    <form action={deleteInsuranceType.bind(null, t.id)}>
                      <button type="submit" className="text-xs text-red-500 hover:text-red-700">
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
    </div>
  );
}
