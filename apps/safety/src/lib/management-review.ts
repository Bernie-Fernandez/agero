import { prisma } from "@/lib/prisma";
import { calcOrgCompliance } from "@/lib/compliance";

export interface ManagementReviewMetric {
  label: string;
  value: string | number;
  sublabel?: string;
  tone: "neutral" | "good" | "warn" | "bad";
}

export interface ManagementReviewResult {
  metrics: ManagementReviewMetric[];
  generatedAt: Date;
}

// Aggregates Safety performance metrics for the IMS management review agenda
// (Sprint S4 §E) over the period [from, to].
export async function buildManagementReview(
  organisationId: string,
  from: Date,
  to: Date,
): Promise<ManagementReviewResult> {
  const range = { gte: from, lte: to };
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const safetyProjects = await prisma.safetyProject.findMany({
    where: { organisationId },
    select: { id: true },
  });
  const spIds = safetyProjects.map((p) => p.id);
  const projectFilter = spIds.length ? spIds : ["00000000-0000-0000-0000-000000000000"];

  const [
    incidentsTotal,
    nearMisses,
    notifiable,
    totalWorkers,
    inductedWorkers,
    expiredCredentials,
    openNcrs,
    walksRecent,
    subOrgs,
    signInsCount,
  ] = await Promise.all([
    prisma.incidentReport.count({ where: { incidentAt: range, projectId: { in: projectFilter } } }),
    prisma.incidentReport.count({ where: { incidentAt: range, projectId: { in: projectFilter }, incidentType: "NEAR_MISS" } }),
    prisma.incidentReport.count({ where: { incidentAt: range, projectId: { in: projectFilter }, workSafeNotifiable: true } }),
    prisma.worker.count({ where: { project: { organisationId } } }),
    prisma.worker.count({ where: { project: { organisationId }, inductionCompletions: { some: { passed: true } } } }),
    prisma.workerCredential.count({ where: { worker: { project: { organisationId } }, expiryDate: { lt: now } } }),
    prisma.nonConformanceReport.count({ where: { projectId: { in: projectFilter }, submittedAt: null } }),
    prisma.siteSafetyWalk.groupBy({
      by: ["projectId"],
      where: { projectId: { in: projectFilter }, conductedAt: { gte: thirtyDaysAgo } },
      _count: { _all: true },
    }),
    prisma.organisation.findMany({
      where: { subcontractorOnProjects: { some: { project: { organisationId } } } },
      include: { documents: true, swmsSubmissions: true },
    }),
    prisma.siteVisit.count({ where: { signedInAt: range, project: { organisationId } } }),
  ]);

  const inductionRate = totalWorkers > 0 ? Math.round((inductedWorkers / totalWorkers) * 100) : null;

  const projectsWithRecentWalk = new Set(walksRecent.map((w) => w.projectId));
  const overdueWalks = spIds.filter((id) => !projectsWithRecentWalk.has(id)).length;

  const compliantSubs = subOrgs.filter(
    (o) => calcOrgCompliance({ documents: o.documents, swmsSubmissions: o.swmsSubmissions }).status === "green",
  ).length;
  const subComplianceRate = subOrgs.length > 0 ? Math.round((compliantSubs / subOrgs.length) * 100) : null;

  const metrics: ManagementReviewMetric[] = [
    { label: "Incidents", value: incidentsTotal, sublabel: `${notifiable} WorkSafe notifiable`, tone: incidentsTotal > 0 ? "warn" : "good" },
    { label: "Near misses reported", value: nearMisses, sublabel: "leading indicator", tone: "neutral" },
    { label: "Site sign-ins", value: signInsCount, sublabel: "attendance (exposure)", tone: "neutral" },
    { label: "Induction completion", value: inductionRate === null ? "—" : `${inductionRate}%`, sublabel: `${inductedWorkers}/${totalWorkers} workers`, tone: inductionRate !== null && inductionRate < 100 ? "warn" : "good" },
    { label: "Overdue safety walks", value: overdueWalks, sublabel: "projects with no walk in 30 days", tone: overdueWalks > 0 ? "bad" : "good" },
    { label: "Outstanding NCRs", value: openNcrs, sublabel: "not yet closed out", tone: openNcrs > 0 ? "warn" : "good" },
    { label: "Expired credentials", value: expiredCredentials, sublabel: "across all workers", tone: expiredCredentials > 0 ? "bad" : "good" },
    { label: "Subcontractor compliance", value: subComplianceRate === null ? "—" : `${subComplianceRate}%`, sublabel: `${compliantSubs}/${subOrgs.length} compliant`, tone: subComplianceRate !== null && subComplianceRate < 100 ? "warn" : "good" },
  ];

  return { metrics, generatedAt: new Date() };
}
