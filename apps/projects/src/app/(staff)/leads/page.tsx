import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import LeadsListClient from './LeadsListClient';

export default async function LeadsPage() {
  const user = await requireAppUser();

  const [leads, clients, users, revenueCodes] = await Promise.all([
    prisma.estimate.findMany({
      where: { organisationId: user.organisationId },
      include: {
        client: { select: { name: true } },
        createdBy: { select: { firstName: true, lastName: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.company.findMany({
      where: { organisationId: user.organisationId, isActive: true, types: { has: 'CLIENT' } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { organisationId: user.organisationId, isActive: true },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    }),
    prisma.costCode.findMany({
      where: { organisationId: user.organisationId, codeType: 'REVENUE' },
      select: { id: true, catCode: true, codeDescription: true },
      orderBy: { catCode: 'asc' },
    }),
  ]);

  return (
    <LeadsListClient
      initialLeads={leads as never}
      clients={clients}
      users={users}
      revenueCodes={revenueCodes}
      currentUserId={user.id}
    />
  );
}
