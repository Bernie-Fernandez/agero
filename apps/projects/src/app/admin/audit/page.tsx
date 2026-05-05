import { requireDirector } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import AuditTrailClient from './AuditTrailClient';

export default async function AuditTrailPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; action?: string; page?: string }>;
}) {
  await requireDirector();
  const sp = await searchParams;

  const page = Math.max(1, parseInt(sp.page ?? '1', 10));
  const pageSize = 50;
  const skip = (page - 1) * pageSize;

  const where = {
    ...(sp.entity ? { entity: sp.entity } : {}),
    ...(sp.action ? { action: sp.action } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  const entities = await prisma.auditLog.findMany({
    select: { entity: true },
    distinct: ['entity'],
    orderBy: { entity: 'asc' },
  });
  const actions = await prisma.auditLog.findMany({
    select: { action: true },
    distinct: ['action'],
    orderBy: { action: 'asc' },
  });

  return (
    <AuditTrailClient
      logs={logs as never}
      total={total}
      page={page}
      pageSize={pageSize}
      entities={entities.map((e) => e.entity)}
      actions={actions.map((a) => a.action)}
      filters={{ entity: sp.entity ?? '', action: sp.action ?? '' }}
    />
  );
}
