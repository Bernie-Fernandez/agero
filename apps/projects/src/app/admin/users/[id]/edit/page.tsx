import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { updateUser } from "../../actions";
import { notFound } from "next/navigation";
import { ROLE_LABELS, ALL_ROLES } from "@/lib/auth";

export default async function EditUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) notFound();

  const updateWithId = updateUser.bind(null, user.id);

  return (
    <div className="max-w-md">
      <div className="mb-6">
        <Link href="/admin/users" className="text-sm text-zinc-500 hover:text-zinc-700">
          &larr; Back to Users
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900 mt-2">Edit User</h1>
        <p className="text-sm text-zinc-500 mt-1">{user.email}</p>
      </div>

      {sp.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          First name, last name, and role are required.
        </div>
      )}

      <form action={updateWithId} className="space-y-4 bg-white border border-gray-200 rounded-lg p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">First Name</label>
            <input
              name="firstName"
              type="text"
              required
              defaultValue={user.firstName}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Last Name</label>
            <input
              name="lastName"
              type="text"
              required
              defaultValue={user.lastName}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
          <input
            type="text"
            value={user.email}
            disabled
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50 text-zinc-400"
          />
          <p className="text-xs text-zinc-400 mt-1">Email is managed via Clerk and cannot be changed here.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Mobile</label>
          <input
            name="mobile"
            type="tel"
            defaultValue={user.mobile ?? ""}
            placeholder="+61 4XX XXX XXX"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Role</label>
            <select
              name="role"
              defaultValue={user.role}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Status</label>
            <select
              name="isActive"
              defaultValue={user.isActive ? "true" : "false"}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
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
            href="/admin/users"
            className="px-4 py-2 border border-gray-300 text-sm text-zinc-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
