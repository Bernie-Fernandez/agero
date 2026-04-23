import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { notFound } from 'next/navigation';
import DashboardClient from './DashboardClient';

export default async function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAppUser();

  const estimate = await prisma.estimate.findFirst({
    where: { id, organisationId: user.organisationId },
    include: {
      lines: { where: { isHidden: false } },
      tradeSections: { orderBy: { order: 'asc' } },
      snapshots: {
        include: { createdBy: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!estimate) notFound();

  return <DashboardClient estimate={estimate as never} />;
}
