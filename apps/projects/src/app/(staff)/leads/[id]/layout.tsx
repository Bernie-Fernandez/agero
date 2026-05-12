import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { notFound } from 'next/navigation';
import LeadDetailTopbar from './LeadDetailTopbar';
import EstimateStepper from '@/components/estimate/EstimateStepper';
import { getEstimateStepperState } from './stepper';

export default async function LeadDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAppUser();

  const estimate = await prisma.estimate.findFirst({
    where: { id, organisationId: user.organisationId },
    select: {
      id: true,
      leadNumber: true,
      title: true,
      status: true,
      pipelineStage: true,
      client: { select: { name: true } },
    },
  });

  if (!estimate) notFound();

  const stepperStages = await getEstimateStepperState(id);

  return (
    <div className="flex flex-col h-[calc(100vh-48px)]">
      <LeadDetailTopbar estimate={estimate} />
      <EstimateStepper stages={stepperStages} estimateId={id} />
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
