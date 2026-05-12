'use server';
import { prisma } from '@/lib/prisma';
import type { StepperStage } from '@/components/estimate/EstimateStepper';

export async function getEstimateStepperState(estimateId: string): Promise<StepperStage[]> {
  const [estimate, docCount, takeoffCount, lineCount, scopeCount, inviteCount, reportRow] =
    await Promise.all([
      prisma.estimate.findFirst({
        where: { id: estimateId },
        select: { status: true, clientId: true, addressStreet: true, jobType: true },
      }),
      prisma.estimateDocumentRegister.count({
        where: { estimateId, status: 'current' },
      }),
      prisma.takeoffImport.count({
        where: { estimateId, importStatus: 'confirmed' },
      }),
      prisma.estimateLine.count({
        where: { estimateId, rate: { gt: 0 } },
      }),
      prisma.estimateLineScope.count({
        where: { estimateLine: { estimateId }, includeInInvitation: true },
      }),
      prisma.subcontractorInvitation.count({
        where: { estimateId, status: 'issued' },
      }),
      prisma.drawingIntelligenceReport.findFirst({
        where: { estimateId },
        select: {
          questionnaireCompleted: true,
          questions: { select: { isMandatory: true, answer: { select: { id: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

  const stage1 = !!(estimate?.clientId && estimate?.addressStreet && estimate?.jobType);

  let stage3: 'complete' | 'pending' | 'na' = 'pending';
  if (!reportRow) {
    stage3 = 'na';
  } else if (reportRow.questionnaireCompleted) {
    stage3 = 'complete';
  } else {
    const mandatory = reportRow.questions.filter((q) => q.isMandatory);
    const allAnswered = mandatory.length > 0 && mandatory.every((q) => q.answer);
    stage3 = allAnswered ? 'complete' : 'pending';
  }

  const won = estimate?.status === 'CONVERTED';
  const lost = estimate?.status === 'ARCHIVED';

  function toStatus(complete: boolean): 'complete' | 'pending' {
    return complete ? 'complete' : 'pending';
  }

  const stages: StepperStage[] = [
    { stage: 1, label: 'Lead created', status: toStatus(stage1) },
    { stage: 2, label: 'Documents uploaded', status: toStatus(docCount > 0) },
    { stage: 3, label: 'Questionnaire', status: stage3 },
    { stage: 4, label: 'Takeoff imported', status: toStatus(takeoffCount > 0) },
    { stage: 5, label: 'Cost plan built', status: toStatus(lineCount > 0) },
    { stage: 6, label: 'Scope drafted', status: toStatus(scopeCount > 0) },
    { stage: 7, label: 'Invitation issued', status: toStatus(inviteCount > 0) },
    { stage: 8, label: 'Won / Lost', status: toStatus(won || lost) },
  ];

  // Mark current: first non-complete stage
  let foundCurrent = false;
  for (const s of stages) {
    if (s.status === 'pending' && !foundCurrent) {
      s.status = 'current';
      foundCurrent = true;
    }
  }

  return stages;
}
