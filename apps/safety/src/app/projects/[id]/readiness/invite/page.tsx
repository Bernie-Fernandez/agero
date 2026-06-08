import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { InviteForm } from "./invite-form";
import { sendInvitations } from "./actions";

export default async function InviteWorkersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole(AGERO_ROLES);

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id },
    select: { id: true, name: true, erpProjectId: true },
  });
  if (!safetyProject) notFound();

  const erpProject = await prisma.project.findUnique({
    where: { id: safetyProject.erpProjectId },
    include: {
      subcontractors: {
        include: {
          subcontractorOrg: { select: { id: true, name: true, tradeCategory: true } },
        },
      },
    },
  });

  const orgs = (erpProject?.subcontractors ?? []).map((s) => s.subcontractorOrg);

  const invitations = await prisma.workerInvitation.findMany({
    where: { projectId: id },
    include: { organisation: { select: { name: true } } },
    orderBy: { invitedAt: "desc" },
    take: 100,
  });

  const submitAction = sendInvitations.bind(null, id, safetyProject.erpProjectId);

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/projects" userRole={user.role} />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <Link
          href={`/projects/${id}/readiness`}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          ← Readiness Dashboard
        </Link>

        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Invite Workers
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{safetyProject.name}</p>

        <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
            Workers receive an SMS with a link to complete their pre-mobilisation safety checklist
            (white card details and next-of-kin). The link expires after 7 days.
          </p>

          {orgs.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No subcontractors on this project. Add subcontractors in the ERP first.
            </p>
          ) : (
            <InviteForm submitAction={submitAction} orgs={orgs} />
          )}
        </div>

        {invitations.length > 0 && (
          <div className="mt-8">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Invitation history
            </h2>
            <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Mobile</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Organisation</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Invited</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                  {invitations.map((inv) => {
                    const expired = inv.status === "PENDING" && new Date() > inv.expiresAt;
                    const statusLabel =
                      inv.status === "ACCEPTED"
                        ? "Accepted"
                        : expired
                          ? "Expired"
                          : "Pending";
                    const statusClass =
                      inv.status === "ACCEPTED"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                        : expired
                          ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
                    return (
                      <tr key={inv.id}>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                          {inv.mobile}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                          {inv.organisation.name}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500">
                          {new Date(inv.invitedAt).toLocaleDateString("en-AU")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
