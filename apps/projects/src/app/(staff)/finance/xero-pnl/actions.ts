'use server';

import { requireDirector } from '@/lib/auth';
import { pullXeroPnLMonth, pullXeroPnLRange } from '@/lib/xero/sync';
import { prisma } from '@/lib/prisma';

export type PnLSnapshotRow = {
  id: string;
  month: number;
  year: number;
  periodStart: string;
  periodEnd: string;
  totalIncome: string;
  totalCostOfSales: string;
  grossProfit: string;
  totalOtherIncome: string;
  totalExpenses: string;
  netProfit: string;
  incomeAccountsJson: unknown;
  cosAccountsJson: unknown;
  expenseAccountsJson: unknown;
  otherIncomeJson: unknown;
  xeroReportLink: string | null;
  pulledAt: string;
};

export async function syncLatestMonth(): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  const now = new Date();
  const month = now.getMonth() + 1; // 1-based
  const year = now.getFullYear();
  const result = await pullXeroPnLMonth(month, year, user.id);
  return { ok: result.ok, error: result.error };
}

export async function syncMonthAction(
  month: number,
  year: number,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  const result = await pullXeroPnLMonth(month, year, user.id);
  return { ok: result.ok, error: result.error };
}

export async function backfillXeroPnL(): Promise<{
  ok: boolean;
  pulled: number;
  errors: string[];
}> {
  const user = await requireDirector();
  // Delete all existing snapshots first — re-pull gives clean, correct data.
  await prisma.xeroPnLSnapshot.deleteMany({ where: { organisationId: user.organisationId } });
  // FY26: Jul 2025 → current month
  const now = new Date();
  const toMonth = now.getMonth() + 1;
  const toYear = now.getFullYear();
  const result = await pullXeroPnLRange(7, 2025, toMonth, toYear, user.id);
  return result;
}

export async function listPnLSnapshots(): Promise<PnLSnapshotRow[]> {
  const user = await requireDirector();
  const rows = await prisma.xeroPnLSnapshot.findMany({
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
  return JSON.parse(JSON.stringify(rows));
}
