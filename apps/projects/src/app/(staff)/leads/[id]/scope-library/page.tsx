import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { notFound } from 'next/navigation';
import ScopeLibraryClient from './ScopeLibraryClient';

export default async function ScopeLibraryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAppUser();

  const estimate = await prisma.estimate.findFirst({
    where: { id, organisationId: user.organisationId },
    select: { id: true, organisationId: true },
  });
  if (!estimate) notFound();

  const [items, tradeSections] = await Promise.all([
    prisma.scopeLibraryItem.findMany({
      where: { organisationId: estimate.organisationId },
      include: { tradeSection: { select: { id: true, name: true, code: true } } },
      orderBy: [{ tradeSectionId: 'asc' }, { description: 'asc' }],
    }),
    prisma.estimateTradeSection.findMany({
      where: { organisationId: estimate.organisationId, estimateId: null },
      orderBy: { order: 'asc' },
    }),
  ]);

  return (
    <ScopeLibraryClient
      estimateId={id}
      items={items as never}
      tradeSections={tradeSections}
    />
  );
}
