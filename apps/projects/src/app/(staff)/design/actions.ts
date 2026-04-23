'use server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';

export async function getDesignDashboard() {
  const user = await requireAppUser();
  const orgId = user.organisationId;

  const now = new Date();
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [
    totalSources,
    activeGlobalSettings,
    pendingApprovals,
    newTrendItemsThisWeek,
    expiringSoon,
    recentTrendItems,
  ] = await Promise.all([
    prisma.designSource.count({ where: { organisationId: orgId, isActive: true } }),
    prisma.designSettingGlobal.count({ where: { organisationId: orgId } }),
    prisma.designSettingNonGlobalProposal.count({ where: { organisationId: orgId, status: 'PENDING' } }),
    prisma.designTrendItem.count({ where: { organisationId: orgId, fetchedAt: { gte: weekAgo }, status: 'NEW' } }),
    prisma.designSource.findMany({
      where: { organisationId: orgId, isActive: true, expiryDate: { lte: in30, gte: now } },
      orderBy: { expiryDate: 'asc' },
      take: 5,
      select: { id: true, title: true, expiryDate: true },
    }),
    prisma.designTrendItem.findMany({
      where: { organisationId: orgId, status: 'NEW' },
      orderBy: [{ publishedAt: 'desc' }, { fetchedAt: 'desc' }],
      take: 5,
      include: { rssFeed: { select: { name: true } } },
    }),
  ]);

  return {
    totalSources,
    activeGlobalSettings,
    pendingApprovals,
    newTrendItemsThisWeek,
    expiringSoon,
    recentTrendItems,
  };
}
