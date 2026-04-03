import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { ComplianceBadge } from "@/components/compliance-badge";
import { calcWorkerCompliance, formatDocType } from "@/lib/compliance";
import { DocumentType } from "@/generated/prisma/client";
import { AddWorkerForm } from "./add-worker-form";
import { addWorker, uploadWorkerDocument } from "./actions";
import { DocUploadForm } from "../doc-upload-form";

const WORKER_DOC_TYPES = [
  DocumentType.white_card,
  DocumentType.trade_licence,
  DocumentType.first_aid,
] as const;

export default async function WorkersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const appUser = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (!appUser) redirect("/onboarding");

  const org = await prisma.organisation.findUnique({ where: { id } });
  if (!org) notFound();

  const workers = await prisma.worker.findMany({
    where: { employingOrganisationId: id },
    include: {
      documents: true,
      inductionCompletions: { include: { template: true } },
      project: { select: { name: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const projects = await prisma.project.findMany({
    where: { organisationId: appUser.organisationId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const addWorkerAction = addWorker.bind(null, id);

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/organisations" />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link href={`/organisations/${id}`} className="text-sm text-zinc-500 hover:text-zinc-700">
          ← {org.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Workers — {org.name}
        </h1>

        <div className="mt-6 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Add worker</h2>
          </div>
          <div className="px-5 py-4">
            <AddWorkerForm addAction={addWorkerAction} projects={projects} />
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {workers.length === 0 ? (
            <p className="text-sm text-zinc-500">No workers yet.</p>
          ) : (
            workers.map((worker) => {
              const { status, reasons } = calcWorkerCompliance(worker);
              return (
                <div key={worker.id} className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between px-5 py-4">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">
                        {worker.firstName} {worker.lastName}
                      </p>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-zinc-500">
                        {worker.trade && <span>{worker.trade}</span>}
                        {worker.mobile && <span>{worker.mobile}</span>}
                        <span>Project: {worker.project.name}</span>
                      </div>
                    </div>
                    <ComplianceBadge status={status} reasons={reasons} />
                  </div>
                  <div className="border-t border-zinc-100 px-5 py-4 dark:border-zinc-800">
                    <p className="mb-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Certifications</p>
                    <div className="space-y-2">
                      {WORKER_DOC_TYPES.map((docType) => {
                        const existing = worker.documents.find((d) => d.type === docType);
                        const uploadAction = uploadWorkerDocument.bind(null, worker.id, id, docType);
                        return (
                          <DocUploadForm
                            key={docType}
                            uploadAction={uploadAction}
                            label={formatDocType(docType)}
                            currentUrl={existing?.url}
                            currentExpiry={existing?.expiryDate}
                          />
                        );
                      })}
                    </div>
                    <div className="mt-3">
                      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">Inductions</p>
                      {worker.inductionCompletions.length === 0 ? (
                        <p className="text-xs text-zinc-400">No inductions completed</p>
                      ) : (
                        <ul className="space-y-1">
                          {worker.inductionCompletions.map((ic) => (
                            <li key={ic.id} className="flex items-center gap-2 text-xs">
                              <span className={ic.passed ? "text-green-600" : "text-red-600"}>
                                {ic.passed ? "✓ Passed" : "✗ Failed"}
                              </span>
                              <span className="text-zinc-500">{ic.template.title} (v{ic.template.version})</span>
                              <span className="text-zinc-400">
                                {new Date(ic.signedAt).toLocaleDateString("en-AU")}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
