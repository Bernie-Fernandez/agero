import Link from "next/link";
import { createThreshold } from "../actions";

export default async function NewThresholdPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="max-w-sm">
      <div className="mb-6">
        <Link href="/admin/thresholds" className="text-sm text-zinc-500 hover:text-zinc-700">
          &larr; Back to Thresholds
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900 mt-2">Add Alert Threshold</h1>
      </div>

      {params.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          Please select a type and enter a valid number of days.
        </div>
      )}

      <form action={createThreshold} className="space-y-4 bg-white border border-gray-200 rounded-lg p-6">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Alert Type <span className="text-red-500">*</span>
          </label>
          <select
            name="alertType"
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="INSURANCE_EXPIRY">Insurance Expiry</option>
            <option value="DOCUMENT_EXPIRY">Document Expiry</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Days Before Expiry <span className="text-red-500">*</span>
          </label>
          <input
            name="daysBefore"
            type="number"
            required
            min="1"
            max="365"
            placeholder="e.g. 90"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            Add Threshold
          </button>
          <Link
            href="/admin/thresholds"
            className="px-4 py-2 border border-gray-300 text-sm text-zinc-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
