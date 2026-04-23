import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { notFound } from 'next/navigation';
import SettingsClient from './SettingsClient';

export default async function EstimateSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAppUser();

  const [estimate, clients] = await Promise.all([
    prisma.estimate.findFirst({
      where: { id, organisationId: user.organisationId },
      include: { client: { select: { id: true, name: true } } },
    }),
    prisma.company.findMany({
      where: { organisationId: user.organisationId, isActive: true, types: { has: 'CLIENT' } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  if (!estimate) notFound();

  return <SettingsClient estimate={estimate as never} clients={clients} />;
}
