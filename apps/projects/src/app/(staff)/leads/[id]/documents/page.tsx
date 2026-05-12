import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { notFound } from 'next/navigation';
import DocumentsClient from './DocumentsClient';

export default async function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAppUser();

  const estimate = await prisma.estimate.findFirst({
    where: { id, organisationId: user.organisationId },
    select: { id: true },
  });
  if (!estimate) notFound();

  const [documents, convention, elementCodes, reports] = await Promise.all([
    prisma.estimateDocumentRegister.findMany({
      where: { estimateId: id },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.estimateDrawingConvention.findFirst({ where: { estimateId: id } }),
    prisma.estimateElementCode.findMany({
      where: { estimateId: id },
      include: { sourceDocument: { select: { documentRef: true, documentTitle: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.drawingIntelligenceReport.findMany({
      where: { estimateId: id },
      include: {
        questions: {
          include: { answer: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const serialiseDocs = documents.map((d) => ({
    id: d.id,
    discipline: d.discipline,
    documentRef: d.documentRef,
    documentTitle: d.documentTitle,
    revision: d.revision,
    issueDate: d.issueDate?.toISOString() ?? null,
    issuedBy: d.issuedBy,
    status: d.status,
    pricedAgainst: d.pricedAgainst,
    storageUrl: d.storageUrl,
    uploadSizeBytes: d.uploadSizeBytes,
    uploadedAt: d.uploadedAt?.toISOString() ?? null,
  }));

  const serialiseCodes = elementCodes.map((c) => ({
    id: c.id,
    code: c.code,
    category: c.category,
    name: c.name,
    description: c.description,
    supplier: c.supplier,
    locationNotes: c.locationNotes,
    leadTime: c.leadTime,
    status: c.status,
    sourceDocument: c.sourceDocument
      ? `${c.sourceDocument.documentRef} — ${c.sourceDocument.documentTitle}`
      : null,
  }));

  const serialiseReports = reports.map((r) => ({
    id: r.id,
    documentId: r.documentId,
    scanStatus: r.scanStatus,
    questionnaireCompleted: r.questionnaireCompleted,
    questions: r.questions.map((q) => ({
      id: q.id,
      layer: q.layer,
      questionText: q.questionText,
      isMandatory: q.isMandatory,
      answer: q.answer ? { id: q.answer.id, answerText: q.answer.answerText } : null,
    })),
  }));

  return (
    <DocumentsClient
      estimateId={id}
      documents={serialiseDocs}
      convention={convention ? {
        spaceReferenceStyle: convention.spaceReferenceStyle,
        revisionFormat: convention.revisionFormat,
        drawingNumberFormat: convention.drawingNumberFormat,
        architectFirm: convention.architectFirm,
        notes: convention.notes,
      } : null}
      elementCodes={serialiseCodes}
      reports={serialiseReports}
    />
  );
}
