import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { notFound } from 'next/navigation';
import TakeoffClient from './TakeoffClient';

export default async function TakeoffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAppUser();

  const estimate = await prisma.estimate.findFirst({
    where: { id, organisationId: user.organisationId },
    select: { id: true, organisationId: true },
  });
  if (!estimate) notFound();

  // Check if questionnaire is complete (or no report exists)
  const latestReport = await prisma.drawingIntelligenceReport.findFirst({
    where: { estimateId: id, scanStatus: 'complete' },
    orderBy: { createdAt: 'desc' },
  });
  const questionnaireRequired = latestReport && !latestReport.questionnaireCompleted;

  const imports = await prisma.takeoffImport.findMany({
    where: { estimateId: id },
    include: {
      measurements: {
        include: { referenceItem: { select: { displayName: true, tradeSectionCode: true } } },
        orderBy: { mappingStatus: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const refItems = await prisma.referenceLibraryItem.findMany({
    where: { organisationId: estimate.organisationId, isActive: true },
    select: { id: true, ageroRef: true, displayName: true, tradeSectionCode: true },
    orderBy: [{ tradeSectionCode: 'asc' }, { displayName: 'asc' }],
  });

  return (
    <TakeoffClient
      estimateId={id}
      questionnaireRequired={!!questionnaireRequired}
      imports={imports.map((imp) => ({
        id: imp.id,
        csvFilename: imp.csvFilename,
        importStatus: imp.importStatus,
        rowCount: imp.rowCount,
        mappedCount: imp.mappedCount,
        unmappedCount: imp.unmappedCount,
        createdAt: imp.createdAt.toISOString(),
        measurements: imp.measurements.map((m) => ({
          id: m.id,
          bluebeamToolName: m.bluebeamToolName,
          ageroRef: m.ageroRef,
          measurementValue: Number(m.measurementValue),
          unit: m.unit,
          drawingSheet: m.drawingSheet,
          mappingStatus: m.mappingStatus,
          referenceItem: m.referenceItem
            ? { displayName: m.referenceItem.displayName, tradeSectionCode: m.referenceItem.tradeSectionCode }
            : null,
        })),
      }))}
      refItems={refItems}
    />
  );
}
