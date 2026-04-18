import Link from "next/link";
import { createCostCode } from "../actions";

const CODE_TYPES = [
  { value: "REVENUE", label: "Revenue" },
  { value: "TIME_CODE", label: "Time Code" },
  { value: "JOB_COST", label: "Job Cost" },
  { value: "PRELIMINARIES", label: "Preliminaries" },
  { value: "OVERHEAD", label: "Overhead" },
  { value: "RETENTION", label: "Retention" },
];

export default async function NewCostCodePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const hasError = params.error === "missing-fields";

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <Link href="/admin/cost-codes" className="text-sm text-zinc-500 hover:text-zinc-700">
          &larr; Back to Cost Codes
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900 mt-2">Add Cost Code</h1>
      </div>

      {hasError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          Please fill in all required fields.
        </div>
      )}

      <form action={createCostCode} className="space-y-4 bg-white border border-gray-200 rounded-lg p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              CAT Code <span className="text-red-500">*</span>
            </label>
            <input
              name="catCode"
              type="text"
              required
              placeholder="e.g. 4105"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">GL Code</label>
            <input
              name="glCode"
              type="text"
              placeholder="e.g. 462"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Group Code <span className="text-red-500">*</span>
            </label>
            <input
              name="groupCode"
              type="text"
              required
              placeholder="e.g. 4100"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Group Name <span className="text-red-500">*</span>
            </label>
            <input
              name="groupName"
              type="text"
              required
              placeholder="e.g. Services"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <input
            name="codeDescription"
            type="text"
            required
            placeholder="e.g. Electrical Contractor"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Code Type <span className="text-red-500">*</span>
            </label>
            <select
              name="codeType"
              required
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
            placeholder="Optional notes"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            Add Cost Code
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
