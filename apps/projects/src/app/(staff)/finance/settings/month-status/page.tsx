import { prisma } from '@/lib/prisma';
import { requireDirector } from '@/lib/auth';
import MonthStatusClient from './MonthStatusClient';

function buildMonthRange() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed; July = 6
  // Australian FY: July–June. If before July, FY started the previous calendar year.
  const fyStartYear = month < 6 ? year - 1 : year;
  const months: Date[] = [];
  for (let i = 0; i < 12; i++) {
    months.push(new Date(Date.UTC(fyStartYear, 6 + i, 1)));
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

  return <MonthStatusClient statuses={JSON.parse(JSON.stringify(statuses))} />;
}
