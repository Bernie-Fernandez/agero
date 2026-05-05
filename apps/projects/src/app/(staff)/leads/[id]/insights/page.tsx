import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { notFound } from 'next/navigation';
import InsightsClient from './InsightsClient';

export default async function InsightsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAppUser();

  const estimate = await prisma.estimate.findFirst({
    where: { id, organisationId: user.organisationId },
    select: { id: true },
  });
  if (!estimate) notFound();

  const [tags, lines] = await Promise.all([
    prisma.estimateInsightTag.findMany({
      where: { estimateId: id },
      include: {
        lineAssignments: {
          include: { line: { select: { id: true, description: true, total: true } } },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.estimateLine.findMany({
      where: { estimateId: id },
      select: { id: true, description: true, total: true, tags: { include: { tag: true } } },
      orderBy: { order: 'asc' },
    }),
  ]);

  return <InsightsClient estimateId={id} tags={tags as never} lines={lines as never} />;
}
