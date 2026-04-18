import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { updateCostCode } from "../../actions";
import { notFound } from "next/navigation";

const CODE_TYPES = [
  { value: "REVENUE", label: "Revenue" },
  { value: "TIME_CODE", label: "Time Code" },
  { value: "JOB_COST", label: "Job Cost" },
  { value: "PRELIMINARIES", label: "Preliminaries" },
  { value: "OVERHEAD", label: "Overhead" },
  { value: "RETENTION", label: "Retention" },
];

export default async function EditCostCodePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cc = await prisma.costCode.findUnique({ where: { id } });
  if (!cc) notFound();

  const updateWithId = updateCostCode.bind(null, cc.id);

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Link href="/admin/cost-codes" className="text-sm text-zinc-500 hover:text-zinc-700">
          &larr; Back to Cost Codes
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900 mt-2">Edit Cost Code</h1>
        <p className="text-sm text-zinc-500 mt-1">CAT Code: <span className="font-mono">{cc.catCode}</span></p>
      </div>

      <form action={updateWithId} className="space-y-4 bg-white border border-gray-200 rounded-lg p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">CAT Code</label>
            <input
              type="text"
              value={cc.catCode}
              disabled
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50 text-zinc-400 font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">GL Code</label>
            <input
              name="glCode"
              type="text"
              defaultValue={cc.glCode ?? ""}
              placeholder="e.g. 462"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Group Code</label>
            <input
              name="groupCode"
              type="text"
              required
              defaultValue={cc.groupCode}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Group Name</label>
            <input
              name="groupName"
              type="text"
              required
              defaultValue={cc.groupName}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Description</label>
          <input
            name="codeDescription"
            type="text"
            required
            defaultValue={cc.codeDescription}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Code Type</label>
            <select
              name="codeType"
              defaultValue={cc.codeType}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CODE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Trade Category?</label>
            <select
              name="isTradeCategory"
              defaultValue={cc.isTradeCategory ? "true" : "false"}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Notes</label>
          <input
            name="notes"
            type="text"
            defaultValue={cc.notes ?? ""}
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
          <Link
            href="/admin/cost-codes"
            className="px-4 py-2 border border-gray-300 text-sm text-zinc-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
