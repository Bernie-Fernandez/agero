import { prisma } from '@/lib/prisma';
import { requireDirector } from '@/lib/auth';
import FinanceProjectsClient from './FinanceProjectsClient';

export default async function FinanceProjectsPage() {
  const user = await requireDirector();

  const currentMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));

  const [projects, monthStatuses] = await Promise.all([
    prisma.financeProject.findMany({
      where: { organisationId: user.organisationId, deletedAt: null },
      orderBy: [{ reportMonth: 'desc' }, { jobNumber: 'asc' }],
    }),
    prisma.monthEndStatus.findMany({
      where: { organisationId: user.organisationId },
      orderBy: { reportMonth: 'desc' },
      take: 12,
    }),
  ]);

  return (
    <FinanceProjectsClient
      projects={projects as never}
      monthStatuses={monthStatuses as never}
      defaultMonth={currentMonth.toISOString().split('T')[0]}
      organisationId={user.organisationId}
    />
  );
}
