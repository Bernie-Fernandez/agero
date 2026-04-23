import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { notFound } from 'next/navigation';
import TradeLetClient from './TradeLetClient';

export default async function TradeLetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAppUser();

  const estimate = await prisma.estimate.findFirst({
    where: { id, organisationId: user.organisationId },
    select: { id: true, organisationId: true },
  });
  if (!estimate) notFound();

  const [packages, tradeSections, subcontractors] = await Promise.all([
    prisma.tradePackage.findMany({
      where: { estimateId: id },
      include: {
        tradeSection: { select: { name: true, code: true } },
        quotes: {
          include: { subcontractor: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.estimateTradeSection.findMany({
      where: { organisationId: estimate.organisationId, estimateId: null },
      orderBy: { order: 'asc' },
    }),
    prisma.company.findMany({
      where: { organisationId: estimate.organisationId, types: { has: 'SUBCONTRACTOR' }, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <TradeLetClient
      estimateId={id}
      packages={packages as never}
      tradeSections={tradeSections}
      subcontractors={subcontractors}
    />
  );
}
