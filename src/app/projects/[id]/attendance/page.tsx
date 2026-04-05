import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { AttendanceDatePicker } from "./date-picker";
import { requireRole, AGERO_ROLES } from "@/lib/auth";

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  const { date } = await searchParams;

  const appUser = await requireRole(AGERO_ROLES);

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || project.organisationId !== appUser.organisationId) notFound();

  const selectedDate = date ? new Date(date) : new Date();
  selectedDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(selectedDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const visits = await prisma.siteVisit.findMany({
    where: {
      projectId: id,
      signedInAt: { gte: selectedDate, lt: nextDay },
    },
    include: {
      worker: { include: { employingOrganisation: true } },
      alert: true,
    },
    orderBy: { signedInAt: "desc" },
  });

  const dateStr = selectedDate.toLocaleDateString("en-AU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/projects" userRole={appUser.role} />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link href={`/projects/${id}`} className="text-sm text-zinc-500 hover:text-zinc-700">
          ← Back to project
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Attendance — {project.name}
          </h1>
          <AttendanceDatePicker
            projectId={id}
            value={selectedDate.toISOString().split("T")[0]}
          />
        </div>
        <p className="mt-1 text-sm text-zinc-500">{dateStr} · {visits.length} sign-in{visits.length !== 1 ? "s" : ""}</p>

        {visits.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-500">No sign-ins recorded for this date.</p>
        ) : (
          <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Worker</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Photo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {visits.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                      {v.worker.firstName} {v.worker.lastName}
                      {v.isUnknown && (
                        <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">Unknown</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {v.worker.employingOrganisation?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(v.signedInAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3">
                      {v.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={v.photoUrl}
                          alt="Sign-in photo"
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {v.verified ? (
                        <span className="text-green-600 dark:text-green-400">
                          Verified{v.verifiedBy ? ` by ${v.verifiedBy}` : ""}
                        </span>
                      ) : v.alert?.escalatedAt ? (
                        <span className="font-medium text-red-600 dark:text-red-400">Escalated</span>
                      ) : v.alert ? (
                        <span className="text-amber-600 dark:text-amber-400">Awaiting verification</span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
