import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { toggleThreshold, deleteThreshold } from "./actions";

const TYPE_LABELS: Record<string, string> = {
  INSURANCE_EXPIRY: "Insurance Expiry",
  DOCUMENT_EXPIRY: "Document Expiry",
};

export default async function ThresholdsPage() {
  const thresholds = await prisma.alertThreshold.findMany({
    orderBy: [{ alertType: "asc" }, { daysBefore: "desc" }],
  });

  const grouped = thresholds.reduce<Record<string, typeof thresholds>>((acc, t) => {
    if (!acc[t.alertType]) acc[t.alertType] = [];
    acc[t.alertType].push(t);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Alert Thresholds</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Trigger alerts this many days before insurance or document expiry
          </p>
        </div>
        <Link
          href="/admin/thresholds/new"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          + Add Threshold
        </Link>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <p className="text-sm text-zinc-400">No thresholds configured.</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([type, items]) => (
            <div key={type}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 px-1">
                {TYPE_LABELS[type] ?? type}
              </h2>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs">Days Before Expiry</th>
                      <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs">Status</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((t, idx) => (
                      <tr
                        key={t.id}
                        className={`${idx < items.length - 1 ? "border-b border-gray-100" : ""} ${!t.isActive ? "opacity-50" : ""}`}
                      >
                        <td className="px-4 py-3 font-medium text-zinc-900">
                          {t.daysBefore} days
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
                            <form action={toggleThreshold.bind(null, t.id, !t.isActive)}>
                              <button type="submit" className="text-xs text-zinc-500 hover:text-zinc-900">
                                {t.isActive ? "Deactivate" : "Activate"}
                              </button>
                            </form>
                            <form action={deleteThreshold.bind(null, t.id)}>
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
          ))}
        </div>
      )}
    </div>
  );
}
