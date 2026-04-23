import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { notFound } from 'next/navigation';
import CostPlanClient from './CostPlanClient';

export default async function CostPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAppUser();

  const estimate = await prisma.estimate.findFirst({
    where: { id, organisationId: user.organisationId },
    include: {
      tradeSections: { orderBy: { order: 'asc' } },
      areas: { orderBy: { order: 'asc' } },
      scenarios: { orderBy: { order: 'asc' } },
      lines: {
        include: {
          tradeSection: { select: { id: true, name: true, code: true } },
          area: { select: { id: true, name: true } },
        },
        orderBy: [{ tradeSectionId: 'asc' }, { order: 'asc' }],
      },
    },
  });

  if (!estimate) notFound();

  const orgSections = await prisma.estimateTradeSection.findMany({
    where: { organisationId: user.organisationId, estimateId: null },
    orderBy: { order: 'asc' },
  });

  return <CostPlanClient estimate={estimate as never} orgTradeSections={orgSections} />;
}
