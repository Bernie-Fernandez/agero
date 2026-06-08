import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { PreStartForm } from "./pre-start-form";
import { submitPreStartAssessment } from "./actions";

const EVENT_LABELS: Record<string, string> = {
  SWMS_APPROVAL: "SWMS Approval",
  INDUCTION: "Induction",
  TOOLBOX_MEETING: "Toolbox Meeting",
  NCR: "NCR",
  PRE_START_INTERNAL: "Pre-Start Internal",
};

export default async function PreStartPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { id } = await params;
  const { done } = await searchParams;
  const user = await requireRole(AGERO_ROLES);

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id },
  });
  if (!safetyProject) notFound();

  const existing = await prisma.preStartAssessment.findFirst({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    include: { completedBy: { select: { name: true, email: true } } },
  });

  // Users available for sign-off dropdown
  const projectUsers = await prisma.user.findMany({
    where: {
      organisationId: user.organisationId,
      role: { in: ["admin", "safety_manager", "project_manager", "site_manager"] },
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });

  const consultationEvents = await prisma.consultationEvent.findMany({
    where: { projectId: id },
    orderBy: { eventDate: "desc" },
  });

  const submitAction = submitPreStartAssessment.bind(null, id);
  const isSigned = !!existing;

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/projects" userRole={user.role} />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link
          href={`/projects/${id}/readiness`}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          ← {safetyProject.name}
        </Link>

        <div className="mt-2">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Pre-Start Risk Assessment
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {safetyProject.name}
            {safetyProject.address && ` · ${safetyProject.address}`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
              ISO 45001 Clause 6.1 &amp; 8.1.4.2
            </span>
            <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
              VIC OHS Regs 2017
            </span>
            <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
              VIC OHS (Psychological Health) Regs 2025
            </span>
          </div>
        </div>

        {/* ── Done screen ─────────────────────────────────────────────────── */}
        {done === "1" && (
          <div className="mt-8 rounded-xl border-2 border-green-300 bg-green-50 p-8 text-center dark:border-green-700 dark:bg-green-950/40">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/60">
              <svg className="h-7 w-7 text-green-700 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-xl font-bold text-green-800 dark:text-green-300">
              Assessment submitted and signed.
            </p>
            <p className="mt-2 text-sm text-green-700 dark:text-green-400">
              A PDF has been generated and emailed to the Director and Safety Manager.
              The Site Preparation Checklist is now unlocked.
            </p>
            <Link
              href={`/projects/${id}/readiness`}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-8 py-4 text-base font-bold text-white shadow-md hover:bg-green-800 sm:w-auto dark:bg-green-600 dark:hover:bg-green-500"
            >
              Return to Readiness Dashboard →
            </Link>
          </div>
        )}

        {/* ── Existing assessment summary ─────────────────────────────────── */}
        {isSigned && done !== "1" && (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Assessment signed</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {existing.signOffName} ·{" "}
                  {new Date(existing.signOffAt).toLocaleString("en-AU", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                Complete
              </span>
            </div>
            {(() => {
              const hrw = (existing.highRiskFlags as Array<{ flagged: boolean }>).filter((f) => f.flagged).length;
              const psych = (existing.psychosocialFlags as Array<{ flagged: boolean }>).filter((f) => f.flagged).length;
              return (
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  <span className={`rounded-full px-2.5 py-0.5 font-medium ${hrw > 0 ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"}`}>
                    {hrw > 0 ? `${hrw} HRW flag${hrw !== 1 ? "s" : ""}` : "No HRW flags"}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 font-medium ${psych > 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"}`}>
                    {psych > 0 ? `${psych} psychosocial hazard${psych !== 1 ? "s" : ""}` : "No psychosocial hazards"}
                  </span>
                </div>
              );
            })()}
            {existing.pdfUrl && (
              <a
                href={existing.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                View PDF →
              </a>
            )}
          </div>
        )}

        {/* ── Panel B: Consultation Event Log ────────────────────────────────── */}
        {consultationEvents.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
              Panel B — Consultation Event Log ({consultationEvents.length})
            </h2>
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/80">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Date</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-medium text-zinc-500 sm:table-cell">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {consultationEvents.map((ev) => (
                    <tr key={ev.id}>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          {EVENT_LABELS[ev.eventType] ?? ev.eventType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {new Date(ev.eventDate).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-zinc-500 sm:table-cell">
                        {ev.notes ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Form ─────────────────────────────────────────────────────────── */}
        {done !== "1" && (
          <div className="mt-8">
            {isSigned ? (
              <div>
                <p className="text-sm text-zinc-500">
                  A signed assessment already exists for this project. Complete a new assessment below if site conditions have changed.
                </p>
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    New assessment ↓
                  </summary>
                  <div className="mt-6">
                    <PreStartForm submitAction={submitAction} projectUsers={projectUsers} projectId={id} />
                  </div>
                </details>
              </div>
            ) : (
              <PreStartForm submitAction={submitAction} projectUsers={projectUsers} projectId={id} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
