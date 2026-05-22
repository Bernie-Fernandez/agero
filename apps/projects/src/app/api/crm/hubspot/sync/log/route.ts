import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const user = await requireAppUser();
  const { searchParams } = req.nextUrl;
  const statusFilter = searchParams.get('status');
  const directionFilter = searchParams.get('direction');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = 100;

  const where: Record<string, unknown> = {};
  if (statusFilter) where.status = statusFilter;
  if (directionFilter) where.direction = directionFilter;

  // Only return logs for leads in this org
  const orgLeadIds = await prisma.lead.findMany({
    where: { organisationId: user.organisationId },
    select: { id: true },
  });
  const ids = orgLeadIds.map((l) => l.id);
  where.OR = [{ leadId: { in: ids } }, { leadId: null }];

  const [total, logs] = await Promise.all([
    prisma.leadSyncLog.count({ where: where as never }),
    prisma.leadSyncLog.findMany({
      where: where as never,
      include: { lead: { select: { id: true, leadName: true } } },
      orderBy: { syncedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({ logs: JSON.parse(JSON.stringify(logs)), total });
}
