import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { addPlantItem, clearFault, deletePlantItem } from "./actions";
import { PlantItemForm } from "./plant-item-form";

export default async function PlantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole(AGERO_ROLES);

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id },
    select: { id: true, name: true, organisationId: true },
  });
  if (!safetyProject || safetyProject.organisationId !== user.organisationId) notFound();

  const items = await prisma.plantItem.findMany({
    where: { projectId: id },
    orderBy: [{ status: "desc" }, { plantType: "asc" }],
  });

  const faulted = items.filter((i) => i.status === "FAULTED").length;

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/projects" userRole={user.role} />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link href={`/projects/${id}/readiness`} className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← {safetyProject.name}
        </Link>
        <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Plant Register</h1>
            <p className="mt-1 text-sm text-zinc-500">Powered mobile plant · daily pre-start · fault blocking</p>
          </div>
          <PlantItemForm submitAction={addPlantItem.bind(null, id)} />
        </div>

        {faulted > 0 && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            <span className="font-medium">{faulted} plant item{faulted !== 1 ? "s" : ""} faulted — must not be used until the fault is resolved.</span>
          </div>
        )}

        {items.length === 0 ? (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">No plant recorded yet.</p>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {items.map((item) => {
              const faultedItem = item.status === "FAULTED";
              const clear = clearFault.bind(null, id, item.id);
              const del = deletePlantItem.bind(null, id, item.id);
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-5 ${
                    faultedItem
                      ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
                      : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{item.plantType}</p>
                        {faultedItem ? (
                          <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                            FAULTED — DO NOT USE
                          </span>
                        ) : item.status === "OUT_OF_SERVICE" ? (
                          <span className="rounded-full bg-zinc-500 px-2.5 py-0.5 text-xs font-medium text-white">Out of service</span>
                        ) : (
                          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                            Operational
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {[item.make, item.model].filter(Boolean).join(" ")}
                        {item.serialNumber ? ` · S/N ${item.serialNumber}` : ""}
                        {item.registrationNumber ? ` · Reg ${item.registrationNumber}` : ""}
                        {item.owner ? ` · ${item.owner}` : ""}
                      </p>
                      {item.nextServiceDate && (
                        <p className="mt-0.5 text-xs text-zinc-400">
                          Next service {item.nextServiceDate.toLocaleDateString("en-AU")}
                        </p>
                      )}
                      {faultedItem && item.faultNotes && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">Fault: {item.faultNotes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Link
                        href={`/projects/${id}/plant/${item.id}`}
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                      >
                        Daily pre-start →
                      </Link>
                      {faultedItem && (
                        <form action={clear}>
                          <button type="submit" className="text-xs text-green-700 hover:underline dark:text-green-400">
                            Resolve fault
                          </button>
                        </form>
                      )}
                      <form action={del}>
                        <button type="submit" className="text-xs text-red-600 hover:underline dark:text-red-400">
                          Remove
                        </button>
                      </form>
                    </div>
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
