import { requireDirector } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import DashboardClient from './DashboardClient';

function fyMonths<T extends { year: number; month: number }>(snapshots: T[]): T[] {
  // Agero FY: Jul 1 – Jun 30. FY26 = Jul 2025 – Jun 2026.
  // Determine FY from the current date; include any synced months in that window.
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const fyStartYear = currentMonth >= 7 ? currentYear : currentYear - 1;

  return snapshots.filter((s) => {
    if (s.year === fyStartYear && s.month >= 7) return true;
    if (s.year === fyStartYear + 1 && s.month <= 6) return true;
    return false;
  });
}

export default async function FinanceDashboardPage() {
  const user = await requireDirector();

  const allSnapshots = await prisma.xeroPnLSnapshot.findMany({
    where: { organisationId: user.organisationId },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
    select: {
      id: true,
      month: true,
      year: true,
      totalIncome: true,
      totalCostOfSales: true,
      grossProfit: true,
      totalExpenses: true,
      netProfit: true,
      expenseAccountsJson: true,
      pulledAt: true,
    },
  });

  const fySnaps = fyMonths(allSnapshots);

  const zero = (val: unknown) => Number(String(val ?? '0'));

  const ytdRevenue = fySnaps.reduce((s, r) => s + zero(r.totalIncome), 0);
  const ytdGrossProfit = fySnaps.reduce((s, r) => s + zero(r.grossProfit), 0);
  const ytdNetProfit = fySnaps.reduce((s, r) => s + zero(r.netProfit), 0);
  const grossMarginPct = ytdRevenue > 0 ? (ytdGrossProfit / ytdRevenue) * 100 : 0;

  const latestSnap = allSnapshots[allSnapshots.length - 1] ?? null;

  return (
    <DashboardClient
      ytdRevenue={ytdRevenue}
      ytdGrossProfit={ytdGrossProfit}
      ytdNetProfit={ytdNetProfit}
      grossMarginPct={grossMarginPct}
      chartData={JSON.parse(JSON.stringify(fySnaps))}
      lastSyncAt={latestSnap ? JSON.parse(JSON.stringify(latestSnap.pulledAt)) : null}
      topExpenses={JSON.parse(JSON.stringify(latestSnap?.expenseAccountsJson ?? []))}
    />
  );
}
