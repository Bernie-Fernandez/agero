import { prisma } from '@/lib/prisma';
import { requireDirector } from '@/lib/auth';
import ReportsClient from './ReportsClient';

export default async function ReportsPage() {
  const user = await requireDirector();

  const [reports, monthStatuses, financeProjects] = await Promise.all([
    prisma.managementReport.findMany({
      where: { organisationId: user.organisationId },
      orderBy: { reportMonth: 'desc' },
      include: {
        preparedBy: { select: { firstName: true, lastName: true } },
        _count: { select: { sections: true } },
      },
    }),
    prisma.monthEndStatus.findMany({
      where: { organisationId: user.organisationId },
      orderBy: { reportMonth: 'desc' },
      take: 24,
    }),
    prisma.financeProject.findMany({
      where: { organisationId: user.organisationId, deletedAt: null },
      select: { reportMonth: true },
      distinct: ['reportMonth'],
      orderBy: { reportMonth: 'desc' },
      take: 24,
    }),
  ]);

  return (
    <ReportsClient
      reports={JSON.parse(JSON.stringify(reports))}
      monthStatuses={JSON.parse(JSON.stringify(monthStatuses))}
      availableMonths={JSON.parse(JSON.stringify(financeProjects))}
    />
  );
}
