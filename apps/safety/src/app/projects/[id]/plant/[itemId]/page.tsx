import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { weekStartMonday, WEEKDAYS } from "@/lib/s3-registers";
import { savePlantPreStart, reportFault, clearFault, type PlantPreStartDay } from "../actions";
import { PreStartGrid } from "./prestart-grid";

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function PlantItemPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = await params;
  const user = await requireRole(AGERO_ROLES);

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id },
    select: { id: true, name: true, organisationId: true },
  });
  if (!safetyProject || safetyProject.organisationId !== user.organisationId) notFound();

  const item = await prisma.plantItem.findFirst({ where: { id: itemId, projectId: id } });
  if (!item) notFound();

  // Current week (Mon–Sun)
  const monday = weekStartMonday(new Date());
  const weekStartStr = toDateStr(monday);
  const weekDates = WEEKDAYS.map((weekday, idx) => {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + idx);
    return { date: toDateStr(d), weekday };
  });

  const existing = await prisma.plantPreStart.findUnique({
    where: { plantItemId_weekStarting: { plantItemId: itemId, weekStarting: monday } },
    select: { days: true },
  });
  const initialDays = (existing?.days as unknown as PlantPreStartDay[]) ?? [];

  const faulted = item.status === "FAULTED";
  const reportFaultAction = reportFault.bind(null, id, itemId);
  const clearFaultAction = clearFault.bind(null, id, itemId);

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/projects" userRole={user.role} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link href={`/projects/${id}/plant`} className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← Plant Register
        </Link>
        <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{item.plantType}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {[item.make, item.model].filter(Boolean).join(" ")}
              {item.serialNumber ? ` · S/N ${item.serialNumber}` : ""}
              {item.registrationNumber ? ` · Reg ${item.registrationNumber}` : ""}
            </p>
          </div>
          {faulted ? (
            <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">FAULTED — DO NOT USE</span>
          ) : (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
              Operational
            </span>
          )}
        </div>

        {faulted && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/30">
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              This plant is blocked from use until the fault is resolved.
            </p>
            {item.faultNotes && <p className="mt-1 text-xs text-red-600 dark:text-red-400">Fault: {item.faultNotes}</p>}
            <form action={clearFaultAction} className="mt-3">
              <button type="submit" className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700">
                Resolve fault &amp; return to service
              </button>
            </form>
          </div>
        )}

        <div className="mt-8">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Daily Pre-Start — week of {monday.toLocaleDateString("en-AU")}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">Complete a pre-start check before operating each day.</p>
          <div className="mt-4">
            <PreStartGrid
              weekDates={weekDates}
              initialDays={initialDays}
              faulted={faulted}
              submitAction={savePlantPreStart.bind(null, id, itemId, weekStartStr)}
            />
          </div>
        </div>

        {!faulted && (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Report a fault</h3>
            <p className="mt-1 text-xs text-zinc-500">Reporting a fault immediately blocks this plant from use.</p>
            <form action={reportFaultAction} className="mt-3 flex gap-2 flex-wrap">
              <input
                name="faultNotes"
                placeholder="Describe the fault…"
                className="flex-1 min-w-[240px] rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <button type="submit" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                Report fault &amp; block
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
