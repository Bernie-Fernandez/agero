import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { createToolboxMeeting } from "./actions";
import { ToolboxForm } from "./toolbox-form";

export default async function ToolboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const { new: showNew } = await searchParams;
  const user = await requireRole(AGERO_ROLES);

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id },
    select: { id: true, name: true, address: true, organisationId: true },
  });
  if (!safetyProject || safetyProject.organisationId !== user.organisationId) notFound();

  const meetings = await prisma.toolboxMeeting.findMany({
    where: { projectId: id },
    include: { conductedBy: { select: { name: true, email: true } } },
    orderBy: { conductedAt: "desc" },
  });

  if (showNew === "1") {
    return (
      <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
        <AppNav currentPath="/projects" userRole={user.role} />
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <Link
            href={`/projects/${id}/toolbox`}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            ← Toolbox Meetings
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            New Toolbox Meeting
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{safetyProject.name}</p>
          <div className="mt-8">
            <ToolboxForm submitAction={createToolboxMeeting.bind(null, id)} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/projects" userRole={user.role} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link
          href={`/projects/${id}/readiness`}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          ← {safetyProject.name}
        </Link>

        <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Toolbox Meetings
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {safetyProject.name}
              {safetyProject.address && ` · ${safetyProject.address}`}
            </p>
          </div>
          <Link
            href={`/projects/${id}/toolbox?new=1`}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + New meeting
          </Link>
        </div>

        {meetings.length === 0 ? (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">No toolbox meetings recorded yet.</p>
            <Link
              href={`/projects/${id}/toolbox?new=1`}
              className="mt-4 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              Record the first meeting →
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {meetings.map((m) => {
              const topics = m.topics as string[];
              const attendees = m.attendees as { name: string; company: string }[];
              const actions = m.actions as { description: string; assignedTo: string; dueDate: string }[];
              return (
                <div
                  key={m.id}
                  className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-start justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {m.conductedAt.toLocaleDateString("en-AU", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          timeZone: "Australia/Melbourne",
                        })}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        Conducted by {m.conductedBy.name ?? m.conductedBy.email} ·{" "}
                        {attendees.length} attendee{attendees.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {m.reportUrl && (
                        <a
                          href={m.reportUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                        >
                          PDF →
                        </a>
                      )}
                      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                        Complete
                      </span>
                    </div>
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-xs font-medium text-zinc-500 mb-2">Topics</p>
                    <div className="flex flex-wrap gap-1.5">
                      {topics.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    {actions.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-zinc-500 mb-1">
                          {actions.length} action{actions.length !== 1 ? "s" : ""}
                        </p>
                        <ul className="space-y-0.5">
                          {actions.map((a, i) => (
                            <li key={i} className="text-xs text-zinc-600 dark:text-zinc-400">
                              • {a.description}{a.assignedTo ? ` — ${a.assignedTo}` : ""}
                              {a.dueDate ? ` (due ${new Date(a.dueDate).toLocaleDateString("en-AU")})` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
