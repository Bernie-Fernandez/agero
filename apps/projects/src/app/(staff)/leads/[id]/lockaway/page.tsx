import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { notFound } from 'next/navigation';
import LockawayClient from './LockawayClient';

export default async function LockawayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAppUser();

  const estimate = await prisma.estimate.findFirst({
    where: { id, organisationId: user.organisationId },
    select: { id: true },
  });
  if (!estimate) notFound();

  const [lockaways, lockawayLines] = await Promise.all([
    prisma.estimateLockaway.findMany({
      where: { estimateId: id },
      include: { lines: { include: { line: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.estimateLine.findMany({
      where: { estimateId: id, isLockaway: true },
      orderBy: { order: 'asc' },
    }),
  ]);

  return <LockawayClient estimateId={id} lockaways={lockaways as never} lockawayLines={lockawayLines as never} />;
}
