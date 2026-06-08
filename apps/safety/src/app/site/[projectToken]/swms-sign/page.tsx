import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AcknowledgeForm } from "./acknowledge-form";
import { acknowledgeSwms } from "./actions";

export default async function SwmsSignPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectToken: string }>;
  searchParams: Promise<{ worker?: string; project?: string }>;
}) {
  const { projectToken } = await params;
  const { worker: workerId, project: safetyProjectId } = await searchParams;

  if (!workerId || !safetyProjectId) notFound();

  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: { id: true, firstName: true, lastName: true, employingOrganisationId: true },
  });
  if (!worker) notFound();

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id: safetyProjectId },
    select: { id: true, name: true },
  });
  if (!safetyProject) notFound();

  const docs = worker.employingOrganisationId
    ? await prisma.swmsDocument.findMany({
        where: {
          projectId: safetyProjectId,
          organisationId: worker.employingOrganisationId,
          isCurrent: true,
          ageroApproved: true,
        },
        select: { id: true, tradeCategory: true, version: true, documentUrl: true },
        orderBy: { tradeCategory: "asc" },
      })
    : [];

  if (docs.length === 0) {
    redirect(`/site/${projectToken}?worker=${workerId}`);
  }

  const existingSigs = await prisma.workerSwmsSignature.findMany({
    where: {
      workerId,
      projectId: safetyProjectId,
      swmsDocumentId: { in: docs.map((d) => d.id) },
    },
    select: { swmsDocumentId: true },
  });
  const alreadySigned = new Set(existingSigs.map((s) => s.swmsDocumentId));
  const unsignedDocs = docs.filter((d) => !alreadySigned.has(d.id));

  if (unsignedDocs.length === 0) {
    redirect(`/site/${projectToken}?worker=${workerId}`);
  }

  const submitAction = acknowledgeSwms.bind(
    null,
    projectToken,
    workerId,
    safetyProjectId,
    unsignedDocs.map((d) => d.id),
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex h-14 max-w-lg items-center px-4">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Agero Safety</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 py-8">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          SWMS Acknowledgement
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{safetyProject.name}</p>

        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          Review the Safe Work Method Statements below before signing.
        </p>

        <div className="mt-4 space-y-3">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {doc.tradeCategory}
                </p>
                <p className="text-xs text-zinc-500">Version {doc.version}</p>
              </div>
              <a
                href={doc.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                View PDF →
              </a>
            </div>
          ))}
        </div>

        <AcknowledgeForm submitAction={submitAction} />
      </main>
    </div>
  );
}
