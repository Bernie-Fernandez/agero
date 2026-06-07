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
  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id },
    include: {
      preStartAssessments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, signOffName: true, signOffAt: true, pdfUrl: true },
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
  });
  if (!safetyProject || safetyProject.organisationId !== user.organisationId) notFound();

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
      swmsSubmissions: {
        select: { organisationId: true, status: true },
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
  const sitePrep = safetyProject.sitePreparationChecklists[0] ?? null;
  const layer1Ready = !!preStart && !!sitePrep;

  // ── Layer 2 ──────────────────────────────────────────────────────────────
  // Best SWMS status per org (approved > pending_review > rejected)
  const SWMS_RANK: Record<string, number> = { approved: 3, pending_review: 2, rejected: 1 };
  const swmsPerOrg = new Map<string, string>();
  for (const s of erpProject?.swmsSubmissions ?? []) {
    const current = swmsPerOrg.get(s.organisationId);
    if (!current || (SWMS_RANK[s.status] ?? 0) > (SWMS_RANK[current] ?? 0)) {
      swmsPerOrg.set(s.organisationId, s.status);
    }
  }

  const layer2Data = (erpProject?.subcontractors ?? []).map(({ subcontractorOrg }) => {
    const compliance = calcOrgCompliance({
      documents: subcontractorOrg.documents,
      swmsSubmissions: erpProject?.swmsSubmissions.filter(
        (s) => s.organisationId === subcontractorOrg.id,
      ),
    });
    const swmsStatus = swmsPerOrg.get(subcontractorOrg.id) ?? "none";
    const isReady = compliance.status !== "red" && swmsStatus === "approved";
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
              <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    Site Preparation Checklist
                  </p>
                  {sitePrep ? (
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Signed by {sitePrep.managerSignOffName} ·{" "}
                      {new Date(sitePrep.managerSignOffAt).toLocaleDateString("en-AU")}
                      {(() => {
                        const arr = sitePrep.items as Array<{ answer: string }>;
                        const no = arr.filter((i) => i.answer === "NO").length;
                        return no > 0 ? ` · ${no} non-compliant item${no !== 1 ? "s" : ""}` : "";
                      })()}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-zinc-500">
                      52 items · VIC OHS Regs 2017 · Locked until pre-start signed
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
                        : preStart
                          ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {sitePrep ? "Complete" : preStart ? "Required" : "Locked"}
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
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              swmsStatus === "approved"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                                : swmsStatus === "pending_review"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                  : swmsStatus === "rejected"
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}
                          >
                            {swmsStatus === "approved"
                              ? "Approved"
                              : swmsStatus === "pending_review"
                                ? "Pending"
                                : swmsStatus === "rejected"
                                  ? "Rejected"
                                  : "None"}
                          </span>
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
        </div>
      </main>
    </div>
  );
}
