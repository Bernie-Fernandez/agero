import { prisma } from '@/lib/prisma';
import { requireDirector } from '@/lib/auth';
import MonthStatusClient from './MonthStatusClient';

// Australian FY: July–June. FY27 = Jul 2026 – Jun 2027.
function currentFY() {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

function buildMonthRange(fy: number) {
  const months: Date[] = [];
  for (let i = 0; i < 12; i++) {
    months.push(new Date(Date.UTC(fy - 1, 6 + i, 1)));
  }
  return months;
}

export default async function MonthStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string }>;
}) {
  const user = await requireDirector();

  const defaultFY = currentFY();
  // Same range as the Budget / Secured Forecast selectors: current FY ± 2.
  const fyOptions = Array.from({ length: 5 }, (_, i) => defaultFY - 2 + i);

  const sp = await searchParams;
  const requestedFY = sp.fy ? Number(sp.fy) : NaN;
  const fy = fyOptions.includes(requestedFY) ? requestedFY : defaultFY;

  const months = buildMonthRange(fy);

  // Ensure the current FY always has a status row for each month. Other financial
  // years are read-only here — we render whatever rows already exist.
  if (fy === defaultFY) {
    for (const m of months) {
      await prisma.monthEndStatus.upsert({
        where: { organisationId_reportMonth: { organisationId: user.organisationId, reportMonth: m } },
        update: {},
        create: { organisationId: user.organisationId, reportMonth: m, status: 'OPEN' },
      });
    }
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

  return (
    <MonthStatusClient
      key={fy}
      statuses={JSON.parse(JSON.stringify(statuses))}
      fy={fy}
      fyOptions={fyOptions}
    />
  );
}
