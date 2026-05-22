import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import LeadsListClient from './LeadsListClient';

export default async function LeadsPage() {
  const user = await requireAppUser();

  const [leads, users, settings] = await Promise.all([
    prisma.lead.findMany({
      where: { organisationId: user.organisationId, deletedAt: null },
      include: { ownerUser: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ syncStatus: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
    }),
    prisma.user.findMany({
      where: { organisationId: user.organisationId, isActive: true },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: 'asc' },
    }),
    prisma.hubSpotSyncSettings.findUnique({
      where: { organisationId: user.organisationId },
      select: { status: true, lastIncrementalSyncAt: true, portalId: true },
    }),
  ]);

  return (
    <LeadsListClient
      initialLeads={JSON.parse(JSON.stringify(leads))}
      users={users}
      hubspotConnected={settings?.status === 'CONNECTED'}
      lastSync={settings?.lastIncrementalSyncAt ? settings.lastIncrementalSyncAt.toISOString() : null}
      portalId={settings?.portalId ?? null}
    />
  );
}
