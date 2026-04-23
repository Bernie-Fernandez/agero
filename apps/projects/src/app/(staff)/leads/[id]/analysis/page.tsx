import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { notFound } from 'next/navigation';
import AnalysisClient from './AnalysisClient';

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAppUser();

  const estimate = await prisma.estimate.findFirst({
    where: { id, organisationId: user.organisationId },
    include: {
      tradeSections: { orderBy: { order: 'asc' } },
      areas: { orderBy: { order: 'asc' } },
      lines: {
        where: { isHidden: false },
        include: {
          tradeSection: { select: { id: true, name: true, code: true } },
          area: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!estimate) notFound();
  return <AnalysisClient estimate={estimate as never} />;
}
