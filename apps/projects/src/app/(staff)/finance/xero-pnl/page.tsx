import { requireDirector } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import XeroPnLClient from './XeroPnLClient';

export default async function XeroPnLPage() {
  const user = await requireDirector();

  const snapshots = await prisma.xeroPnLSnapshot.findMany({
    where: { organisationId: user.organisationId },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    select: {
      id: true,
      month: true,
      year: true,
      periodStart: true,
      periodEnd: true,
      totalIncome: true,
      totalCostOfSales: true,
      grossProfit: true,
      totalOtherIncome: true,
      totalExpenses: true,
      netProfit: true,
      incomeAccountsJson: true,
      cosAccountsJson: true,
      expenseAccountsJson: true,
      otherIncomeJson: true,
      xeroReportLink: true,
      pulledAt: true,
    },
  });

  return <XeroPnLClient initialSnapshots={JSON.parse(JSON.stringify(snapshots))} />;
}
