import { prisma } from "@/lib/prisma";
import { getAppUser } from "@/lib/auth";
import Link from "next/link";
import { toggleUserActive } from "./actions";

const ROLE_LABELS: Record<string, string> = {
  DIRECTOR: "Director",
  PROJECT_MANAGER: "Project Manager",
  SAFETY_MANAGER: "Safety Manager",
  SITE_MANAGER: "Site Manager",
};

const ROLE_COLORS: Record<string, string> = {
  DIRECTOR: "bg-purple-100 text-purple-700",
  PROJECT_MANAGER: "bg-blue-100 text-blue-700",
  SAFETY_MANAGER: "bg-orange-100 text-orange-700",
  SITE_MANAGER: "bg-teal-100 text-teal-700",
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const currentUser = await getAppUser();

  const users = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { firstName: "asc" }],
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Users</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {users.filter((u) => u.isActive).length} active &middot; New users sign up via Clerk then appear here
          </p>
        </div>
      </div>

      {params.error === "cannot-deactivate-self" && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          You cannot deactivate your own account.
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs">Name</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs">Email</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs">Mobile</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs">Role</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, idx) => (
              <tr
                key={u.id}
                className={`${idx < users.length - 1 ? "border-b border-gray-100" : ""} ${!u.isActive ? "opacity-50" : ""}`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-semibold text-zinc-600">
                      {u.firstName[0]}{u.lastName[0]}
                    </div>
                    <span className="font-medium text-zinc-900">{u.firstName} {u.lastName}</span>
                    {u.id === currentUser?.id && (
                      <span className="text-xs text-zinc-400">(you)</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-600">{u.email}</td>
                <td className="px-4 py-3 text-zinc-500">{u.mobile ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] ?? "bg-gray-100 text-gray-600"}`}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    u.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <Link href={`/admin/users/${u.id}/edit`} className="text-xs text-blue-600 hover:underline">
                      Edit
                    </Link>
                    {u.id !== currentUser?.id && (
                      <form action={toggleUserActive.bind(null, u.id, !u.isActive)}>
                        <button type="submit" className="text-xs text-zinc-500 hover:text-zinc-900">
                          {u.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-400 mt-4">
        To add a new user: have them sign up at the app URL. They will appear here after their first login once linked to this organisation.
      </p>
    </div>
  );
}
