import { prisma } from '@/lib/prisma';
import { requireDirector } from '@/lib/auth';
import MonthStatusClient from './MonthStatusClient';

function buildMonthRange() {
  const now = new Date();
  const months: Date[] = [];
  for (let i = -5; i <= 2; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    months.push(d);
  }
  return months;
}

export default async function MonthStatusPage() {
  const user = await requireDirector();

  const months = buildMonthRange();

  // Ensure all months have a status row
  for (const m of months) {
    await prisma.monthEndStatus.upsert({
      where: { organisationId_reportMonth: { organisationId: user.organisationId, reportMonth: m } },
      update: {},
      create: { organisationId: user.organisationId, reportMonth: m, status: 'OPEN' },
    });
  }

  const statuses = await prisma.monthEndStatus.findMany({
    where: {
      organisationId: user.organisationId,
      reportMonth: { in: months },
    },
    include: {
      markedReadyBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { reportMonth: 'asc' },
  });

  return <MonthStatusClient statuses={statuses as never} />;
}
