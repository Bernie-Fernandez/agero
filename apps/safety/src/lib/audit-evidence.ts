import { prisma } from "@/lib/prisma";
import type { AuditEvidenceSection } from "@/lib/pdf/audit-evidence-pdf";

const fmt = (d: Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-AU", { timeZone: "Australia/Melbourne" }) : "—";

export interface AuditEvidenceResult {
  sections: AuditEvidenceSection[];
  consultationEvents: { type: string; date: string; detail: string }[];
  totalRecords: number;
}

// Builds the ISO 45001 audit evidence package for an organisation over [from, to].
// Sections follow the Sprint S4 §4 clause mapping.
export async function buildAuditEvidence(
  organisationId: string,
  from: Date,
  to: Date,
): Promise<AuditEvidenceResult> {
  const range = { gte: from, lte: to };

  const safetyProjects = await prisma.safetyProject.findMany({
    where: { organisationId },
    select: { id: true },
  });
  const spIds = safetyProjects.map((p) => p.id);
  const projectFilter = spIds.length ? spIds : ["00000000-0000-0000-0000-000000000000"];

  const [
    credentials,
    inductions,
    toolboxes,
    preStarts,
    manualHandling,
    traffic,
    taskRisk,
    msds,
    swms,
    perfRecords,
    firstAid,
    incidents,
    walks,
    testTags,
    ncrs,
    annualReviews,
    legislationUpdates,
    consultations,
  ] = await Promise.all([
    prisma.workerCredential.findMany({
      where: { createdAt: range, worker: { project: { organisationId } } },
      include: { worker: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.inductionCompletion.findMany({
      where: { signedAt: range, passed: true, worker: { project: { organisationId } } },
      include: { worker: { select: { firstName: true, lastName: true } } },
      orderBy: { signedAt: "desc" },
    }),
    prisma.toolboxMeeting.findMany({
      where: { conductedAt: range, projectId: { in: projectFilter } },
      include: { conductedBy: { select: { name: true, email: true } } },
      orderBy: { conductedAt: "desc" },
    }),
    prisma.preStartAssessment.findMany({
      where: { signOffAt: range, projectId: { in: projectFilter } },
      include: { project: { select: { name: true } } },
      orderBy: { signOffAt: "desc" },
    }),
    prisma.manualHandlingAssessment.findMany({
      where: { conductedAt: range, projectId: { in: projectFilter } },
      include: { conductedBy: { select: { name: true, email: true } } },
      orderBy: { conductedAt: "desc" },
    }),
    prisma.trafficManagementReview.findMany({
      where: { conductedAt: range, projectId: { in: projectFilter } },
      include: { conductedBy: { select: { name: true, email: true } } },
      orderBy: { conductedAt: "desc" },
    }),
    prisma.taskRiskAssessment.findMany({
      where: { conductedAt: range, projectId: { in: projectFilter } },
      include: { conductedBy: { select: { name: true, email: true } } },
      orderBy: { conductedAt: "desc" },
    }),
    prisma.mSDSRegister.findMany({
      where: { createdAt: range, projectId: { in: projectFilter } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.swmsDocument.findMany({
      where: { ageroApprovedAt: range, ageroApproved: true, projectId: { in: projectFilter } },
      include: { organisation: { select: { name: true } } },
      orderBy: { ageroApprovedAt: "desc" },
    }),
    prisma.subcontractorPerformanceRecord.findMany({
      where: { occurredAt: range, organisation: { subcontractorOnProjects: { some: { project: { organisationId } } } } },
      include: { organisation: { select: { name: true } } },
      orderBy: { occurredAt: "desc" },
    }),
    prisma.firstAidChecklist.findMany({
      where: { conductedAt: range, projectId: { in: projectFilter } },
      include: { conductedBy: { select: { name: true, email: true } } },
      orderBy: { conductedAt: "desc" },
    }),
    prisma.incidentReport.findMany({
      where: { incidentAt: range, projectId: { in: projectFilter } },
      include: { reportedBy: { select: { name: true, email: true } } },
      orderBy: { incidentAt: "desc" },
    }),
    prisma.siteSafetyWalk.findMany({
      where: { conductedAt: range, projectId: { in: projectFilter } },
      include: { conductedBy: { select: { name: true, email: true } } },
      orderBy: { conductedAt: "desc" },
    }),
    prisma.testTagRegister.findMany({
      where: { createdAt: range, projectId: { in: projectFilter } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.nonConformanceReport.findMany({
      where: { raisedAt: range, projectId: { in: projectFilter } },
      include: { raisedBy: { select: { name: true, email: true } } },
      orderBy: { raisedAt: "desc" },
    }),
    prisma.annualReview.findMany({
      where: { reviewedAt: range, organisationId },
      orderBy: { reviewedAt: "desc" },
    }),
    prisma.legislationRegister.findMany({
      where: { lastReviewedDate: range, organisationId },
      orderBy: { lastReviewedDate: "desc" },
    }),
    prisma.consultationEvent.findMany({
      where: { eventDate: range, projectId: { in: projectFilter } },
      orderBy: { eventDate: "desc" },
    }),
  ]);

  const sections: AuditEvidenceSection[] = [
    {
      clause: "7.2",
      requirement: "Competence",
      records: credentials.map((c) => ({
        form: "Worker credential",
        date: fmt(c.createdAt),
        signatory: `${c.worker.firstName} ${c.worker.lastName}`,
        detail: `${c.credentialType.replace(/_/g, " ")}${c.credentialNumber ? ` · ${c.credentialNumber}` : ""}${c.isVerified ? " · verified" : ""}`,
      })),
    },
    {
      clause: "7.3",
      requirement: "Awareness",
      records: [
        ...inductions.map((i) => ({
          form: "Induction completion",
          date: fmt(i.signedAt),
          signatory: `${i.worker.firstName} ${i.worker.lastName}`,
          detail: "Induction passed",
        })),
        ...toolboxes.map((t) => ({
          form: "Toolbox meeting",
          date: fmt(t.conductedAt),
          signatory: t.conductedBy.name ?? t.conductedBy.email,
          detail: `${(t.attendees as unknown[]).length} attendees`,
        })),
      ],
    },
    {
      clause: "8.1.2",
      requirement: "Hazard identification and risk assessment",
      records: [
        ...preStarts.map((p) => ({ form: "Pre-start risk assessment", date: fmt(p.signOffAt), signatory: p.signOffName, detail: p.project.name })),
        ...manualHandling.map((m) => ({ form: "Manual handling assessment", date: fmt(m.conductedAt), signatory: m.conductedBy.name ?? m.conductedBy.email, detail: m.taskDescription.slice(0, 60) })),
        ...traffic.map((t) => ({ form: "Traffic management review", date: fmt(t.conductedAt), signatory: t.conductedBy.name ?? t.conductedBy.email, detail: "AS 1742.3-2009" })),
        ...taskRisk.map((t) => ({ form: "Task risk assessment", date: fmt(t.conductedAt), signatory: t.conductedBy.name ?? t.conductedBy.email, detail: t.taskDescription.slice(0, 60) })),
        ...msds.map((m) => ({ form: "MSDS register entry", date: fmt(m.createdAt), signatory: m.addedByName, detail: m.productName })),
      ],
    },
    {
      clause: "8.1.4.2",
      requirement: "Contractor management",
      records: [
        ...swms.map((s) => ({ form: "SWMS approval", date: fmt(s.ageroApprovedAt), signatory: s.ageroApprovedBy ?? "—", detail: `${s.organisation.name} · ${s.tradeCategory}` })),
        ...perfRecords.map((p) => ({ form: "Subcontractor performance", date: fmt(p.occurredAt), signatory: p.recordedByName, detail: `${p.organisation.name} · ${p.recordType.replace(/_/g, " ")}` })),
      ],
    },
    {
      clause: "8.2",
      requirement: "Emergency preparedness",
      records: [
        ...firstAid.map((f) => ({ form: "First aid checklist", date: fmt(f.conductedAt), signatory: f.conductedBy.name ?? f.conductedBy.email, detail: f.checklistType.replace(/_/g, " ") })),
        ...incidents.map((i) => ({ form: "Incident investigation", date: fmt(i.incidentAt), signatory: i.reportedBy.name ?? i.reportedBy.email, detail: `${i.incidentType.replace(/_/g, " ")}${i.workSafeNotifiable ? " · WorkSafe notifiable" : ""}` })),
      ],
    },
    {
      clause: "9.1",
      requirement: "Monitoring and measurement",
      records: [
        ...walks.map((w) => ({ form: "Site safety walk", date: fmt(w.conductedAt), signatory: w.conductedBy.name ?? w.conductedBy.email, detail: "Monthly walk" })),
        ...testTags.map((t) => ({ form: "Test & tag", date: fmt(t.createdAt), signatory: t.addedByName, detail: `${t.itemName} · next ${fmt(t.nextTestDate)}` })),
      ],
    },
    {
      clause: "10.2",
      requirement: "Incident and nonconformance",
      records: [
        ...incidents.map((i) => ({ form: "Incident report", date: fmt(i.incidentAt), signatory: i.reportedBy.name ?? i.reportedBy.email, detail: i.location })),
        ...ncrs.map((n) => ({ form: "Non-conformance report", date: fmt(n.raisedAt), signatory: n.raisedBy.name ?? n.raisedBy.email, detail: n.ncrNumber })),
      ],
    },
    {
      clause: "10.3",
      requirement: "Continual improvement",
      records: [
        ...annualReviews.map((a) => ({ form: "Annual review", date: fmt(a.reviewedAt), signatory: a.reviewerName, detail: `${a.templateKey} → v${a.version} (${a.outcome})` })),
        ...legislationUpdates.map((l) => ({ form: "Legislation review", date: fmt(l.lastReviewedDate), signatory: l.updatedByName ?? "—", detail: `${l.title} (v${l.version})` })),
      ],
    },
  ];

  const consultationEvents = consultations.map((c) => ({
    type: c.eventType.replace(/_/g, " "),
    date: fmt(c.eventDate),
    detail: c.notes ?? "—",
  }));

  const totalRecords = sections.reduce((sum, s) => sum + s.records.length, 0);

  return { sections, consultationEvents, totalRecords };
}
