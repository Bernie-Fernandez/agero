import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { notFound } from 'next/navigation';
import ReportsClient from './ReportsClient';

export default async function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAppUser();

  const estimate = await prisma.estimate.findFirst({
    where: { id, organisationId: user.organisationId },
    include: {
      client: { select: { name: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      tradeSections: { orderBy: { order: 'asc' } },
      areas: { orderBy: { order: 'asc' } },
      lines: {
        include: {
          tradeSection: { select: { id: true, name: true, code: true } },
          area: { select: { id: true, name: true } },
        },
        orderBy: [{ tradeSectionId: 'asc' }, { order: 'asc' }],
      },
      snapshots: {
        include: { createdBy: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!estimate) notFound();
  return <ReportsClient estimate={estimate as never} />;
}
