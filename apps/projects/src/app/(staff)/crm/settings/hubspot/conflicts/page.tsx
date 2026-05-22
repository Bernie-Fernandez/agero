import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import ConflictsClient from './ConflictsClient';

export default async function ConflictsPage() {
  const user = await requireAppUser();

  const conflicts = await prisma.lead.findMany({
    where: { organisationId: user.organisationId, syncStatus: 'CONFLICT', deletedAt: null },
    include: {
      ownerUser: { select: { id: true, firstName: true, lastName: true } },
      syncLogs: {
        where: { status: 'CONFLICT' },
        orderBy: { syncedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return <ConflictsClient conflicts={JSON.parse(JSON.stringify(conflicts))} />;
}
