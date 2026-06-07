import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { WorkerEditForm } from "./worker-edit-form";
import { BuildingMgmtRecordForm, BuildingMgmtRemoveForm } from "./building-mgmt-form";
import {
  updateWorkerMobReadiness,
  markBuildingMgmtComplete,
  removeBuildingMgmtComplete,
} from "./actions";

export default async function WorkerEditPage({
  params,
}: {
  params: Promise<{ id: string; workerId: string }>;
}) {
  const { id, workerId } = await params;
  const user = await requireRole(AGERO_ROLES);

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      organisationId: true,
      erpProjectId: true,
      buildingMgmtInductionRequired: true,
    },
  });
  if (!safetyProject) notFound();

  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      mobile: true,
      trade: true,
      whiteCardNo: true,
      whiteCardExpiry: true,
      nokName: true,
      nokPhone: true,
      nokRelationship: true,
      projectId: true,
    },
  });
  if (!worker || worker.projectId !== safetyProject.erpProjectId) notFound();

  // Look up WorkerAccount + existing building mgmt completion
  const workerAccount = worker.mobile
    ? await prisma.workerAccount.findUnique({
        where: { mobile: worker.mobile },
        select: { id: true },
      })
    : null;

  const bldgCompletion =
    workerAccount && safetyProject.buildingMgmtInductionRequired
      ? await prisma.buildingMgmtInduction.findUnique({
          where: {
            projectId_workerAccountId: {
              projectId: safetyProject.id,
              workerAccountId: workerAccount.id,
            },
          },
          select: { completedAt: true, completedByName: true },
        })
      : null;

  const updateAction = updateWorkerMobReadiness.bind(null, safetyProject.id, worker.id);
  const markAction = markBuildingMgmtComplete.bind(null, safetyProject.id, worker.id);
  const removeAction = removeBuildingMgmtComplete.bind(null, safetyProject.id, worker.id);

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/projects" userRole={user.role} />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <Link
          href={`/projects/${safetyProject.id}/readiness`}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          ← Readiness Dashboard
        </Link>
        <div className="mt-2">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {worker.firstName} {worker.lastName}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {safetyProject.name}
            {worker.trade ? ` · ${worker.trade}` : ""}
            {worker.mobile ? ` · ${worker.mobile}` : ""}
          </p>
        </div>

        {/* White card + NOK */}
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Pre-mobilisation details
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            These fields are required for site access once a Pre-Start Assessment is signed.
          </p>
          <WorkerEditForm worker={worker} action={updateAction} />
        </div>

        {/* Building mgmt induction */}
        {safetyProject.buildingMgmtInductionRequired && (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Building Management Induction
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Required before this worker can sign in to site. Record after the building
              manager has conducted the induction.
            </p>

            {!worker.mobile ? (
              <p className="mt-3 text-sm text-zinc-500">
                Worker has no mobile number on record — cannot track induction.
              </p>
            ) : !workerAccount ? (
              <p className="mt-3 text-sm text-zinc-500">
                Worker has not registered a WorkerAccount. They need to sign in via SMS at
                least once before the induction can be recorded.
              </p>
            ) : bldgCompletion ? (
              <BuildingMgmtRemoveForm completion={bldgCompletion} removeAction={removeAction} />
            ) : (
              <BuildingMgmtRecordForm markAction={markAction} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
