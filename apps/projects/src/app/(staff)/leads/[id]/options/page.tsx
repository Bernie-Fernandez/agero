import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { notFound } from 'next/navigation';
import OptionsClient from './OptionsClient';

export default async function OptionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAppUser();

  const estimate = await prisma.estimate.findFirst({
    where: { id, organisationId: user.organisationId },
    select: { id: true },
  });
  if (!estimate) notFound();

  const [options, lines] = await Promise.all([
    prisma.estimateOption.findMany({
      where: { estimateId: id },
      include: { lines: { include: { line: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.estimateLine.findMany({
      where: { estimateId: id, isOption: true },
      orderBy: { order: 'asc' },
    }),
  ]);

  return <OptionsClient estimateId={id} options={options as never} optionLines={lines as never} />;
}
