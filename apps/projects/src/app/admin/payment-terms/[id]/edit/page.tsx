import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { updatePaymentTerm } from "../../actions";
import { notFound } from "next/navigation";

export default async function EditPaymentTermPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const term = await prisma.paymentTerm.findUnique({ where: { id } });
  if (!term) notFound();

  const updateWithId = updatePaymentTerm.bind(null, term.id);

  return (
    <div className="max-w-md">
      <div className="mb-6">
        <Link href="/admin/payment-terms" className="text-sm text-zinc-500 hover:text-zinc-700">
          &larr; Back to Payment Terms
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900 mt-2">Edit Payment Term</h1>
      </div>

      <form action={updateWithId} className="space-y-4 bg-white border border-gray-200 rounded-lg p-6">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Name</label>
          <input
            name="name"
            type="text"
            required
            defaultValue={term.name}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Description</label>
          <input
            name="description"
            type="text"
            defaultValue={term.description ?? ""}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Default?</label>
            <select
              name="isDefault"
              defaultValue={term.isDefault ? "true" : "false"}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Display Order</label>
            <input
              name="displayOrder"
              type="number"
              min="1"
              defaultValue={term.displayOrder ?? ""}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            Save Changes
          </button>
          <Link
            href="/admin/payment-terms"
            className="px-4 py-2 border border-gray-300 text-sm text-zinc-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
