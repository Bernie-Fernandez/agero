import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import HubSpotSettingsClient from './HubSpotSettingsClient';

export default async function HubSpotSettingsPage() {
  const user = await requireAppUser();

  const [settings, recentLogs] = await Promise.all([
    prisma.hubSpotSyncSettings.findUnique({
      where: { organisationId: user.organisationId },
      include: { connectedBy: { select: { firstName: true, lastName: true } } },
    }),
    prisma.leadSyncLog.findMany({
      where: { lead: { organisationId: user.organisationId } },
      include: { lead: { select: { leadName: true } } },
      orderBy: { syncedAt: 'desc' },
      take: 100,
    }),
  ]);

  return (
    <HubSpotSettingsClient
      settings={JSON.parse(JSON.stringify(settings))}
      recentLogs={JSON.parse(JSON.stringify(recentLogs))}
    />
  );
}
