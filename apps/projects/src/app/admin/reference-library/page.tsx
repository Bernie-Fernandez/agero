import { prisma } from '@/lib/prisma';
import { requireDirector } from '@/lib/auth';
import ReferenceLibraryClient from './ReferenceLibraryClient';

export default async function ReferenceLibraryPage() {
  const user = await requireDirector();

  const items = await prisma.referenceLibraryItem.findMany({
    where: { organisationId: user.organisationId },
    include: {
      rates: {
        where: { rateType: 'standard' },
        select: { unitCost: true },
        take: 1,
      },
    },
    orderBy: [{ tradeSectionCode: 'asc' }, { sortOrder: 'asc' }, { displayName: 'asc' }],
  });

  const serialised = items.map((item) => ({
    id: item.id,
    ageroRef: item.ageroRef,
    displayName: item.displayName,
    tradeSectionCode: item.tradeSectionCode,
    tradeGroupColour: item.tradeGroupColour,
    unit: item.unit,
    natspecRef: item.natspecRef,
    asRef: item.asRef,
    isActive: item.isActive,
    standardRate: item.rates[0] ? Number(item.rates[0].unitCost) : null,
  }));

  return (
    <div className="p-6">
      <ReferenceLibraryClient items={serialised} organisationId={user.organisationId} />
    </div>
  );
}
