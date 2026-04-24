import { prisma } from '@/lib/prisma';
import { requireDirector } from '@/lib/auth';
import VerifyClient from './VerifyClient';

export default async function VerifyPage() {
  const user = await requireDirector();

  const march2026 = new Date('2026-03-01');

  const [pnl, bankBalances, projects, budgets, monthStatus] = await Promise.all([
    prisma.xeroPnL.findFirst({
      where: { organisationId: user.organisationId, reportMonth: march2026 },
    }),
    prisma.xeroBankBalance.findMany({
      where: { organisationId: user.organisationId, reportMonth: march2026 },
      orderBy: { accountName: 'asc' },
    }),
    prisma.financeProject.findMany({
      where: { organisationId: user.organisationId, reportMonth: march2026, deletedAt: null },
      orderBy: { jobNumber: 'asc' },
    }),
    prisma.annualBudget.findMany({
      where: { organisationId: user.organisationId, financialYear: 2026 },
      orderBy: [{ displayOrder: 'asc' }, { category: 'asc' }],
    }),
    prisma.monthEndStatus.findUnique({
      where: { organisationId_reportMonth: { organisationId: user.organisationId, reportMonth: march2026 } },
    }),
  ]);

  return (
    <VerifyClient
      pnl={pnl as never}
      bankBalances={bankBalances as never}
      projects={projects as never}
      budgets={budgets as never}
      monthStatus={monthStatus as never}
      reportMonth="2026-03"
    />
  );
}
