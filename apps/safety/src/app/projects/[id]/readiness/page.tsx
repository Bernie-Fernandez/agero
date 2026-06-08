import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { calcOrgCompliance } from "@/lib/compliance";
import {
  checkWorkerReadiness,
  currentPassedTemplateIds,
  type ReadinessStatus,
} from "@/lib/readiness";
import { toggleBuildingMgmtRequired } from "./actions";

function StatusDot({ status }: { status: ReadinessStatus }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${
        status === "ready"
          ? "bg-green-500"
          : status === "warning"
            ? "bg-amber-400"
            : "bg-red-500"
      }`}
    />
  );
}

function CheckIcon({ ok, warn }: { ok: boolean; warn?: boolean }) {
  if (ok && !warn)
    return <span className="text-sm font-medium text-green-600 dark:text-green-400">✓</span>;
  if (warn)
    return <span className="text-sm font-medium text-amber-500 dark:text-amber-400">!</span>;
  return <span className="text-sm font-medium text-red-600 dark:text-red-400">✗</span>;
}

export default async function ReadinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole(AGERO_ROLES);

  // ── SafetyProject ────────────────────────────────────────────────────────
  const [safetyProject, safetySwmsDocs] = await Promise.all([
    prisma.safetyProject.findUnique({
      where: { id },
      include: {
        preStartAssessments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, signOffName: true, signOffAt: true, pdfUrl: true },
        },
        sitePreparationPlan: {
          select: { status: true, signOffName: true, signOffAt: true },
        },
        sitePreparationChecklists: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            managerSignOffName: true,
            managerSignOffAt: true,
            pdfUrl: true,
            items: true,
          },
        },
        buildingMgmtInductions: {
          include: { workerAccount: { select: { mobile: true } } },
        },
      },
    }),
    prisma.swmsDocument.findMany({
      where: { projectId: id, isCurrent: true },
      select: { organisationId: true, ageroApproved: true },
    }),
  ]);
  if (!safetyProject) notFound();

  // ── ERP Project ──────────────────────────────────────────────────────────
  const erpProject = await prisma.project.findUnique({
    where: { id: safetyProject.erpProjectId },
    include: {
      subcontractors: {
        include: {
          subcontractorOrg: {
            include: { documents: { select: { type: true, expiryDate: true } } },
          },
        },
      },
      workers: {
        include: {
          inductionCompletions: {
            where: { passed: true },
            select: { templateId: true, signedAt: true },
          },
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      },
      inductionTemplates: {
        where: { isActive: true, type: "site_specific" },
        take: 1,
        select: { id: true },
      },
    },
  });

  // ── Layer 1 ──────────────────────────────────────────────────────────────
  const preStart = safetyProject.preStartAssessments[0] ?? null;
  const sitePrepPlan = safetyProject.sitePreparationPlan;
  const sitePrep = safetyProject.sitePreparationChecklists[0] ?? null;
  const layer1Ready = !!preStart && !!sitePrep;

  // ── Layer 2 ──────────────────────────────────────────────────────────────
  // Safety platform SWMS: approved if at least one current doc is ageroApproved=true
  const swmsApprovedOrgs = new Set<string>();
  const swmsPendingOrgs = new Set<string>();
  for (const doc of safetySwmsDocs) {
    if (doc.ageroApproved === true) swmsApprovedOrgs.add(doc.organisationId);
    else if (doc.ageroApproved === null) swmsPendingOrgs.add(doc.organisationId);
  }

  const layer2Data = (erpProject?.subcontractors ?? []).map(({ subcontractorOrg }) => {
    const compliance = calcOrgCompliance({
      documents: subcontractorOrg.documents,
    });
    const swmsApproved = swmsApprovedOrgs.has(subcontractorOrg.id);
    const swmsPending = !swmsApproved && swmsPendingOrgs.has(subcontractorOrg.id);
    const swmsStatus = swmsApproved ? "approved" : swmsPending ? "pending" : "none";
    const isReady = compliance.status !== "red" && swmsApproved;
    return { subcontractorOrg, compliance, swmsStatus, isReady };
  });
  const layer2Ready = layer2Data.length === 0 || layer2Data.every((s) => s.isReady);

  // ── Layer 3 ──────────────────────────────────────────────────────────────
  const bldgCompletedMobiles = new Set(
    safetyProject.buildingMgmtInductions.map((i) => i.workerAccount.mobile),
  );
  const siteTemplateId = erpProject?.inductionTemplates[0]?.id ?? null;

  const layer3Data = (erpProject?.workers ?? []).map((worker) => {
    const passedIds = currentPassedTemplateIds(worker.inductionCompletions);
    const result = checkWorkerReadiness({
      whiteCardNo: worker.whiteCardNo,
      whiteCardExpiry: worker.whiteCardExpiry,
      nokName: worker.nokName,
      nokPhone: worker.nokPhone,
      passedTemplateIds: passedIds,
      siteTemplateId,
      buildingMgmtRequired: safetyProject.buildingMgmtInductionRequired,
      buildingMgmtCompleted: worker.mobile
        ? bldgCompletedMobiles.has(worker.mobile)
        : false,
    });
    return { worker, result };
  });
  const layer3NotReady = layer3Data.filter((w) => w.result.status === "not_ready").length;
  const layer3Warn = layer3Data.filter((w) => w.result.status === "warning").length;
  const layer3Ready = layer3NotReady === 0;

  // ── Overall mobilisation gate ─────────────────────────────────────────────
  const canMobilise = layer1Ready && layer2Ready && layer3Ready;
  const overallStatus: ReadinessStatus = canMobilise
    ? "ready"
    : layer3Warn > 0 && layer3NotReady === 0 && layer1Ready && layer2Ready
      ? "warning"
      : "not_ready";

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/projects" userRole={user.role} />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* Breadcrumb */}
        <Link
          href={`/projects/${safetyProject.erpProjectId}`}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          ← {safetyProject.name}
        </Link>

        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Readiness Dashboard
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {safetyProject.name}
              {safetyProject.address && ` · ${safetyProject.address}`}
            </p>
          </div>
          <div
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
              overallStatus === "ready"
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                : overallStatus === "warning"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                  : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
            }`}
          >
            {overallStatus === "ready"
              ? "Ready to mobilise"
              : overallStatus === "warning"
                ? "Warnings — review required"
                : "Not ready — action required"}
          </div>
        </div>

        {/* Mobilisation gate summary */}
        {!canMobilise && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            <span className="font-medium">Mobilisation blocked.</span>{" "}
            {[
              !layer1Ready && "Layer 1 incomplete",
              !layer2Ready && "Layer 2: subcontractor compliance issues",
              !layer3Ready &&
                `Layer 3: ${layer3NotReady} worker${layer3NotReady !== 1 ? "s" : ""} not ready`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        )}

        <div className="mt-8 space-y-8">
          {/* ── LAYER 1 ─────────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-3">
              <StatusDot status={layer1Ready ? "ready" : "not_ready"} />
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Layer 1 — Agero Obligations
              </h2>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              {/* Pre-Start */}
              <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    Pre-Start Risk Assessment
                  </p>
                  {preStart ? (
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Signed by {preStart.signOffName} ·{" "}
                      {new Date(preStart.signOffAt).toLocaleDateString("en-AU")}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-zinc-500">
                      ISO 45001 Clause 6.1 · VIC OHS Regs 2017
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {preStart && preStart.pdfUrl && (
                    <a
                      href={preStart.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      PDF →
                    </a>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      preStart
                        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                        : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                    }`}
                  >
                    {preStart ? "Complete" : "Required"}
                  </span>
                  <Link
                    href={`/projects/${id}/pre-start`}
                    className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    {preStart ? "View →" : "Start →"}
                  </Link>
                </div>
              </div>

              {/* Site Prep */}
              {/* Site Prep Phase 1 */}
              <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    Site Preparation Plan
                    <span className="ml-1.5 rounded px-1.5 py-0.5 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                      Phase 1
                    </span>
                  </p>
                  {sitePrepPlan?.status === "COMPLETE" ? (
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Signed by {sitePrepPlan.signOffName} ·{" "}
                      {sitePrepPlan.signOffAt &&
                        new Date(sitePrepPlan.signOffAt).toLocaleDateString("en-AU")}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-zinc-500">
                      10 categories · plan before mobilisation
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      sitePrepPlan?.status === "COMPLETE"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                        : preStart
                          ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {sitePrepPlan?.status === "COMPLETE" ? "Complete" : preStart ? "Required" : "Locked"}
                  </span>
                  <Link
                    href={`/projects/${id}/site-prep`}
                    className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    {sitePrepPlan?.status === "COMPLETE" ? "View →" : "Start →"}
                  </Link>
                </div>
              </div>

              {/* Site Prep Phase 2 */}
              <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    Site Preparation Checklist
                    <span className="ml-1.5 rounded px-1.5 py-0.5 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                      Phase 2
                    </span>
                  </p>
                  {sitePrep ? (
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Signed by {sitePrep.managerSignOffName} ·{" "}
                      {new Date(sitePrep.managerSignOffAt).toLocaleDateString("en-AU")}
                      {(() => {
                        const arr = sitePrep.items as Array<{ answer: string }>;
                        const no = arr.filter((i) => i.answer === "NO").length;
                        return no > 0 ? ` · ${no} non-compliant section${no !== 1 ? "s" : ""}` : "";
                      })()}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-zinc-500">
                      10 categories · VIC OHS Regs 2017 · locked until Phase 1 signed
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {sitePrep?.pdfUrl && (
                    <a
                      href={sitePrep.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      PDF →
                    </a>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      sitePrep
                        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                        : sitePrepPlan?.status === "COMPLETE"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {sitePrep
                      ? "Complete"
                      : sitePrepPlan?.status === "COMPLETE"
                        ? "Required"
                        : "Locked"}
                  </span>
                  <Link
                    href={`/projects/${id}/site-prep`}
                    className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    {sitePrep ? "View →" : "Start →"}
                  </Link>
                </div>
              </div>

              {/* Building mgmt induction config */}
              <div className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    Building Management Induction
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Required per worker before site access
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      safetyProject.buildingMgmtInductionRequired
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {safetyProject.buildingMgmtInductionRequired ? "Required" : "Not required"}
                  </span>
                  <form
                    action={toggleBuildingMgmtRequired.bind(
                      null,
                      id,
                      !safetyProject.buildingMgmtInductionRequired,
                    )}
                  >
                    <button
                      type="submit"
                      className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    >
                      {safetyProject.buildingMgmtInductionRequired ? "Disable →" : "Enable →"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </section>

          {/* ── LAYER 2 ─────────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-3">
              <StatusDot
                status={
                  layer2Data.length === 0
                    ? "ready"
                    : layer2Data.every((s) => s.isReady)
                      ? "ready"
                      : layer2Data.some((s) => s.compliance.status === "red")
                        ? "not_ready"
                        : "warning"
                }
              />
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Layer 2 — Subcontractor Compliance
                <span className="ml-2 text-sm font-normal text-zinc-500">
                  ({layer2Data.length} {layer2Data.length === 1 ? "company" : "companies"})
                </span>
              </h2>
              <Link
                href={`/projects/${id}/swms`}
                className="ml-auto text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                SWMS Registry →
              </Link>
            </div>

            {layer2Data.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">
                No subcontractors on this project yet.
              </p>
            ) : (
              <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                      <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500">
                        Company
                      </th>
                      <th className="hidden px-4 py-3 text-left text-xs font-medium text-zinc-500 sm:table-cell">
                        Trade
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                        Insurance
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                        SWMS
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                    {layer2Data.map(({ subcontractorOrg, compliance, swmsStatus, isReady }) => (
                      <tr key={subcontractorOrg.id}>
                        <td className="px-5 py-3">
                          <Link
                            href={`/organisations/${subcontractorOrg.id}`}
                            className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                          >
                            {subcontractorOrg.name}
                          </Link>
                          {compliance.reasons.length > 0 && (
                            <ul className="mt-0.5 space-y-0.5">
                              {compliance.reasons.map((r) => (
                                <li key={r} className="text-xs text-red-600 dark:text-red-400">
                                  {r}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-zinc-500 sm:table-cell">
                          {subcontractorOrg.tradeCategory ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              compliance.status === "green"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                                : compliance.status === "amber"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                            }`}
                          >
                            {compliance.status === "green"
                              ? "Current"
                              : compliance.status === "amber"
                                ? "Expiring"
                                : "Issues"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                swmsStatus === "approved"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                                  : swmsStatus === "pending"
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                              }`}
                            >
                              {swmsStatus === "approved"
                                ? "Approved"
                                : swmsStatus === "pending"
                                  ? "Pending"
                                  : "None"}
                            </span>
                            <Link
                              href={`/projects/${id}/swms`}
                              className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                            >
                              →
                            </Link>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              isReady
                                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                            }`}
                          >
                            {isReady ? "Ready" : "Not ready"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── LAYER 3 ─────────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-3">
              <StatusDot
                status={
                  layer3Data.length === 0
                    ? "ready"
                    : layer3NotReady > 0
                      ? "not_ready"
                      : layer3Warn > 0
                        ? "warning"
                        : "ready"
                }
              />
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Layer 3 — Worker Readiness
                <span className="ml-2 text-sm font-normal text-zinc-500">
                  ({layer3Data.length} {layer3Data.length === 1 ? "worker" : "workers"})
                </span>
              </h2>
              {layer3NotReady > 0 && (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                  {layer3NotReady} blocked
                </span>
              )}
              {layer3Warn > 0 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  {layer3Warn} warning{layer3Warn !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {layer3Data.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">No workers registered on this project.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                      <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500">
                        Worker
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500">
                        White Card
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500">
                        NOK
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500">
                        Site Induction
                      </th>
                      {safetyProject.buildingMgmtInductionRequired && (
                        <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500">
                          Bldg Mgmt
                        </th>
                      )}
                      <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">
                        Gate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                    {layer3Data.map(({ worker, result }) => (
                      <tr
                        key={worker.id}
                        className={
                          result.status === "not_ready"
                            ? "bg-red-50/30 dark:bg-red-950/10"
                            : result.status === "warning"
                              ? "bg-amber-50/30 dark:bg-amber-950/10"
                              : ""
                        }
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-zinc-900 dark:text-zinc-50">
                              {worker.firstName} {worker.lastName}
                            </p>
                            {result.status !== "ready" && (
                              <Link
                                href={`/projects/${id}/readiness/worker/${worker.id}`}
                                className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                              >
                                Edit →
                              </Link>
                            )}
                          </div>
                          {result.issues.length > 0 && (
                            <p className="mt-0.5 text-xs text-zinc-500">
                              {result.issues.join(" · ")}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <CheckIcon
                            ok={result.whiteCardOk}
                            warn={result.whiteCardExpiring && result.whiteCardOk}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <CheckIcon ok={result.nokOk} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {siteTemplateId ? (
                            <CheckIcon ok={result.siteInductionOk} />
                          ) : (
                            <span className="text-xs text-zinc-400">N/A</span>
                          )}
                        </td>
                        {safetyProject.buildingMgmtInductionRequired && (
                          <td className="px-4 py-3 text-center">
                            <CheckIcon ok={result.buildingMgmtOk} />
                          </td>
                        )}
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              result.status === "ready"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                                : result.status === "warning"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                            }`}
                          >
                            {result.status === "ready"
                              ? "Ready"
                              : result.status === "warning"
                                ? "Warning"
                                : "Blocked"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {layer3NotReady > 0 && (
              <p className="mt-3 text-xs text-zinc-500">
                Blocked workers will be prevented from signing in to site until their pre-mobilisation
                requirements are met. Speak to the site manager to update worker records.
              </p>
            )}
          </section>

          {/* ── SITE MANAGEMENT (S2) ─────────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-3">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-400" />
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Site Management
              </h2>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              {[
                {
                  label: "Daily Attendance Dashboard",
                  desc: "Live worker and visitor count, First Aider check, person-hours",
                  href: `/projects/${safetyProject.erpProjectId}/attendance/today`,
                },
                {
                  label: "Site Safety Walk",
                  desc: "23-item checklist, psychosocial observation, 7-day overdue alert",
                  href: `/projects/${id}/safety-walk`,
                },
                {
                  label: "Toolbox Meetings",
                  desc: "Attendee signatures, mandatory psychosocial topic, ConsultationEvent",
                  href: `/projects/${id}/toolbox`,
                },
                {
                  label: "NCR — Non-Conformance Reports",
                  desc: "Three-part form, dual digital signatures, immutable on submit",
                  href: `/projects/${id}/ncr`,
                },
                {
                  label: "Incident Reports",
                  desc: "Classification, WorkSafe notifiability, 48-hr timer, 5-year retention",
                  href: `/projects/${id}/incident`,
                },
                {
                  label: "First Aid Management",
                  desc: "Requirements checklist, first aider register (60-day expiry alerts), box inspections",
                  href: `/projects/${id}/first-aid`,
                },
                {
                  label: "Visitor Management",
                  desc: "Visitor sign-in kiosk with safety acknowledgement, sign-out tracking",
                  href: `/projects/${id}/visitors`,
                },
                {
                  label: "Dilapidation Survey",
                  desc: "Pre-works condition survey, pin-drop on floor plan, PDF emailed to stakeholders",
                  href: `/projects/${id}/dilapidation`,
                },
                {
                  label: "Defects Register",
                  desc: "Pin-drop defects, trade responsible, DLP tracking, status management",
                  href: `/projects/${id}/defects`,
                },
              ].map((item, i, arr) => (
                <div
                  key={item.href}
                  className={`flex items-center justify-between px-5 py-3 ${i < arr.length - 1 ? "border-b border-zinc-100 dark:border-zinc-800" : ""}`}
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{item.label}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{item.desc}</p>
                  </div>
                  <Link
                    href={item.href}
                    className="shrink-0 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    Open →
                  </Link>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
