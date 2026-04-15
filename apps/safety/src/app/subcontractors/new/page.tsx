import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { InviteForm } from "./invite-form";
import { requireRole, ADMIN_MANAGER_ROLES } from "@/lib/auth";

export default async function InviteSubcontractorPage() {
  const appUser = await requireRole(ADMIN_MANAGER_ROLES);

  const [recent, projects] = await Promise.all([
    prisma.invitation.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.project.findMany({
      where: { organisationId: appUser.organisationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/subcontractors" userRole={appUser.role} />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link href="/subcontractors" className="text-sm text-zinc-500 hover:text-zinc-700">← Subcontractors</Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Invite subcontractor</h1>
        <p className="mt-1 text-sm text-zinc-500">Send a registration link to a subcontractor company. They will complete their profile and upload compliance documents.</p>

        <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <InviteForm projects={projects} />
        </div>

        {recent.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Recent invitations</h2>
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Contact</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Sent</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {recent.map((inv) => (
                    <tr key={inv.id}>
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">{inv.companyName}</td>
                      <td className="px-4 py-3 text-zinc-500">{inv.contactName} · {inv.email}</td>
                      <td className="px-4 py-3 text-zinc-500">{new Date(inv.createdAt).toLocaleDateString("en-AU")}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          inv.status === "registered" ? "bg-green-100 text-green-700" :
                          inv.status === "expired" ? "bg-zinc-100 text-zinc-500" :
                          "bg-amber-100 text-amber-700"
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
