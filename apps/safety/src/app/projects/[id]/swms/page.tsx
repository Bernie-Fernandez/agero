import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, AGERO_ROLES, ADMIN_MANAGER_ROLES } from "@/lib/auth";
import { SwmsUploadForm } from "./upload-form";
import { uploadSwmsDocument, approveSwmsDocument, rejectSwmsDocument } from "./actions";
import { OfflinePdfNotice } from "./offline-pdf-notice";

export default async function SwmsRegistryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole(AGERO_ROLES);
  const canApprove = (ADMIN_MANAGER_ROLES as string[]).includes(user.role);

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id },
    select: { id: true, name: true, address: true, erpProjectId: true },
  });
  if (!safetyProject) notFound();

  // Load subcontractor orgs for this project via ERP
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

  const subcontractorOrgs = (erpProject?.subcontractors ?? []).map((s) => s.subcontractorOrg);

  // Load all SwmsDocuments for this safety project
  const allDocs = await prisma.swmsDocument.findMany({
    where: { projectId: id },
    orderBy: [{ organisationId: "asc" }, { tradeCategory: "asc" }, { version: "desc" }],
  });

  // Group docs by orgId → tradeCategory → docs[]
  const docsByOrg = new Map<string, Map<string, typeof allDocs>>();
  for (const doc of allDocs) {
    if (!docsByOrg.has(doc.organisationId)) {
      docsByOrg.set(doc.organisationId, new Map());
    }
    const byTrade = docsByOrg.get(doc.organisationId)!;
    if (!byTrade.has(doc.tradeCategory)) {
      byTrade.set(doc.tradeCategory, []);
    }
    byTrade.get(doc.tradeCategory)!.push(doc);
  }

  // Orgs that have SWMS docs but aren't in the ERP subcontractors list
  const extraOrgIds = [...docsByOrg.keys()].filter(
    (orgId) => !subcontractorOrgs.some((o) => o.id === orgId),
  );
  const extraOrgs = extraOrgIds.length
    ? await prisma.organisation.findMany({
        where: { id: { in: extraOrgIds } },
        select: { id: true, name: true, tradeCategory: true },
      })
    : [];

  const allOrgs = [...subcontractorOrgs, ...extraOrgs];

  // Overall registry stats
  const pendingCount = allDocs.filter((d) => d.ageroApproved === null && d.isCurrent).length;
  const approvedCount = allDocs.filter((d) => d.ageroApproved === true && d.isCurrent).length;

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

        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              SWMS Registry
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {safetyProject.name}
              {safetyProject.address && ` · ${safetyProject.address}`}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                {pendingCount} pending review
              </span>
            )}
            {approvedCount > 0 && (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300">
                {approvedCount} approved
              </span>
            )}
          </div>
        </div>

        <OfflinePdfNotice />

        {allOrgs.length === 0 ? (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">
              No subcontractors on this project. Add subcontractors in the ERP to manage their SWMS here.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {allOrgs.map((org) => {
              const byTrade = docsByOrg.get(org.id);
              const currentDocs = allDocs.filter((d) => d.organisationId === org.id && d.isCurrent);
              const orgApproved = currentDocs.length > 0 && currentDocs.every((d) => d.ageroApproved === true);
              const orgPending = currentDocs.some((d) => d.ageroApproved === null);
              const orgStatus = currentDocs.length === 0
                ? "none"
                : orgApproved
                  ? "approved"
                  : orgPending
                    ? "pending"
                    : "rejected";

              return (
                <div
                  key={org.id}
                  className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {/* Org header */}
                  <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{org.name}</p>
                      {org.tradeCategory && (
                        <p className="mt-0.5 text-xs text-zinc-500">{org.tradeCategory}</p>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        orgStatus === "approved"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                          : orgStatus === "pending"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                            : orgStatus === "rejected"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                              : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {orgStatus === "approved"
                        ? "Approved"
                        : orgStatus === "pending"
                          ? "Pending review"
                          : orgStatus === "rejected"
                            ? "Rejected"
                            : "No SWMS"}
                    </span>
                  </div>

                  {/* Documents grouped by trade */}
                  {byTrade && byTrade.size > 0 && (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {[...byTrade.entries()].map(([trade, docs]) => {
                        const currentDoc = docs.find((d) => d.isCurrent);
                        return (
                          <div key={trade} className="px-5 py-4">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                                {trade}
                              </p>
                              {currentDoc && (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                    currentDoc.ageroApproved === true
                                      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                                      : currentDoc.ageroApproved === false
                                        ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                  }`}
                                >
                                  {currentDoc.ageroApproved === true
                                    ? "Approved"
                                    : currentDoc.ageroApproved === false
                                      ? "Rejected"
                                      : "Pending"}
                                </span>
                              )}
                            </div>

                            {/* Document list */}
                            <div className="mt-2 space-y-2">
                              {docs.map((doc) => (
                                <div
                                  key={doc.id}
                                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-xs ${
                                    doc.isCurrent
                                      ? "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800"
                                      : "border-zinc-100 bg-white opacity-50 dark:border-zinc-800 dark:bg-zinc-900"
                                  }`}
                                >
                                  <span className="font-medium text-zinc-600 dark:text-zinc-400">
                                    v{doc.version}
                                  </span>
                                  <span className="text-zinc-400">
                                    {new Date(doc.createdAt).toLocaleDateString("en-AU")}
                                  </span>
                                  {!doc.isCurrent && (
                                    <span className="text-zinc-400 italic">superseded</span>
                                  )}
                                  {doc.ageroApproved !== null && doc.isCurrent && (
                                    <span className="text-zinc-500">
                                      {doc.ageroApproved ? "Approved" : "Rejected"} by{" "}
                                      {doc.ageroApprovedBy} ·{" "}
                                      {doc.ageroApprovedAt &&
                                        new Date(doc.ageroApprovedAt).toLocaleDateString("en-AU")}
                                    </span>
                                  )}
                                  <a
                                    href={doc.documentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-auto text-blue-600 hover:underline dark:text-blue-400"
                                  >
                                    View PDF →
                                  </a>
                                </div>
                              ))}
                            </div>

                            {/* Review buttons for pending current doc */}
                            {canApprove && currentDoc && currentDoc.ageroApproved === null && (
                              <div className="mt-3">
                                {/* Inline PDF viewer */}
                                <div className="mb-3 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
                                  <iframe
                                    src={currentDoc.documentUrl}
                                    className="w-full"
                                    style={{ height: "400px" }}
                                    title={`SWMS — ${trade}`}
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <form
                                    action={approveSwmsDocument.bind(
                                      null,
                                      currentDoc.id,
                                      id,
                                    )}
                                  >
                                    <button
                                      type="submit"
                                      className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
                                    >
                                      Approve
                                    </button>
                                  </form>
                                  <form
                                    action={rejectSwmsDocument.bind(
                                      null,
                                      currentDoc.id,
                                      id,
                                    )}
                                  >
                                    <button
                                      type="submit"
                                      className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-300"
                                    >
                                      Reject
                                    </button>
                                  </form>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Upload form */}
                  <div className="border-t border-zinc-100 px-5 py-4 dark:border-zinc-800">
                    <p className="mb-3 text-xs font-medium text-zinc-500">
                      {byTrade && byTrade.size > 0 ? "Upload new or replacement SWMS" : "Upload SWMS"}
                    </p>
                    <SwmsUploadForm
                      uploadAction={uploadSwmsDocument.bind(null, id, org.id)}
                      defaultTradeCategory={org.tradeCategory ?? ""}
                    />
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
