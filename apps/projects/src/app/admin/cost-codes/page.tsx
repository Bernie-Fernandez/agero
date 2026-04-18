import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { toggleCostCodeActive, deleteCostCode } from "./actions";
import { ConfirmForm } from "@/components/ConfirmForm";

const TYPE_LABELS: Record<string, string> = {
  REVENUE: "Revenue",
  TIME_CODE: "Time Code",
  JOB_COST: "Job Cost",
  PRELIMINARIES: "Preliminaries",
  OVERHEAD: "Overhead",
  RETENTION: "Retention",
};

const TYPE_COLORS: Record<string, string> = {
  REVENUE: "bg-green-100 text-green-700",
  TIME_CODE: "bg-blue-100 text-blue-700",
  JOB_COST: "bg-orange-100 text-orange-700",
  PRELIMINARIES: "bg-purple-100 text-purple-700",
  OVERHEAD: "bg-yellow-100 text-yellow-700",
  RETENTION: "bg-red-100 text-red-700",
};

export default async function CostCodesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; active?: string }>;
}) {
  const params = await searchParams;
  const filterType = params.type || "";
  const filterActive = params.active !== "false";

  const costCodes = await prisma.costCode.findMany({
    where: {
      ...(filterType ? { codeType: filterType as never } : {}),
      isActive: filterActive,
    },
    orderBy: [{ displayOrder: "asc" }, { catCode: "asc" }],
  });

  const grouped = costCodes.reduce<Record<string, typeof costCodes>>((acc, cc) => {
    const key = `${cc.groupCode} — ${cc.groupName}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(cc);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Cost Codes</h1>
          <p className="text-sm text-zinc-500 mt-1">{costCodes.length} codes loaded from CAT Cloud</p>
        </div>
        <Link
          href="/admin/cost-codes/new"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          + Add Code
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {["", "REVENUE", "TIME_CODE", "JOB_COST", "PRELIMINARIES", "OVERHEAD", "RETENTION"].map((t) => (
          <Link
            key={t || "all"}
            href={`/admin/cost-codes${t ? `?type=${t}` : ""}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterType === t
                ? "bg-zinc-900 text-white"
                : "bg-white border border-gray-200 text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {t ? TYPE_LABELS[t] : "All"}
          </Link>
        ))}
        <Link
          href={`/admin/cost-codes?active=${filterActive ? "false" : "true"}`}
          className="ml-auto px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-gray-200 text-zinc-600 hover:bg-zinc-50"
        >
          Show {filterActive ? "inactive" : "active"}
        </Link>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <p className="text-sm text-zinc-400">No cost codes found.</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([group, codes]) => (
            <div key={group}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 px-1">
                {group}
              </h2>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">CAT Code</th>
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Description</th>
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Type</th>
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">GL Code</th>
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Trade</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {codes.map((cc, idx) => (
                      <tr
                        key={cc.id}
                        className={`${idx < codes.length - 1 ? "border-b border-gray-100" : ""} ${!cc.isActive ? "opacity-50" : ""}`}
                      >
                        <td className="px-4 py-2.5 font-mono text-xs text-zinc-700">{cc.catCode}</td>
                        <td className="px-4 py-2.5 text-zinc-800">{cc.codeDescription}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[cc.codeType]}`}>
                            {TYPE_LABELS[cc.codeType]}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-zinc-500">{cc.glCode || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-zinc-500">
                          {cc.isTradeCategory ? "Yes" : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2 justify-end">
                            <Link
                              href={`/admin/cost-codes/${cc.id}/edit`}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Edit
                            </Link>
                            <form
                              action={toggleCostCodeActive.bind(null, cc.id, !cc.isActive)}
                            >
                              <button type="submit" className="text-xs text-zinc-500 hover:text-zinc-900">
                                {cc.isActive ? "Deactivate" : "Activate"}
                              </button>
                            </form>
                            <ConfirmForm
                              action={deleteCostCode.bind(null, cc.id)}
                              message="Delete this cost code?"
                            >
                              <button type="submit" className="text-xs text-red-500 hover:text-red-700">
                                Delete
                              </button>
                            </ConfirmForm>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
