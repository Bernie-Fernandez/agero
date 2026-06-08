'use server';

import { requireDirector } from '@/lib/auth';
import { pullXeroBalanceSheetMonth, pullXeroBalanceSheetRange } from '@/lib/xero/sync';
import { prisma } from '@/lib/prisma';

export type BSSnapshotRow = {
  id: string;
  reportMonth: string;
  snapshotDate: string;
  totalCurrentAssets: string | null;
  totalNonCurrentAssets: string | null;
  totalAssets: string | null;
  totalCurrentLiabilities: string | null;
  totalNonCurrentLiabilities: string | null;
  totalLiabilities: string | null;
  totalEquity: string | null;
  cashAndBankBalances: string | null;
  accountsReceivable: string | null;
  accountsPayable: string | null;
  retentionsHeld: string | null;
  wipAsset: string | null;
  syncedAt: string;
};

export async function listBalanceSheetSnapshots(): Promise<BSSnapshotRow[]> {
  const user = await requireDirector();
  const rows = await prisma.xeroBalanceSheetSnapshot.findMany({
    where: { organisationId: user.organisationId },
    orderBy: { reportMonth: 'desc' },
    select: {
      id: true,
      reportMonth: true,
      snapshotDate: true,
      totalCurrentAssets: true,
      totalNonCurrentAssets: true,
      totalAssets: true,
      totalCurrentLiabilities: true,
      totalNonCurrentLiabilities: true,
      totalLiabilities: true,
      totalEquity: true,
      cashAndBankBalances: true,
      accountsReceivable: true,
      accountsPayable: true,
      retentionsHeld: true,
      wipAsset: true,
      syncedAt: true,
    },
  });
  return JSON.parse(JSON.stringify(rows));
}

export async function syncBalanceSheetMonth(
  month: number,
  year: number,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  return pullXeroBalanceSheetMonth(month, year, user.id);
}

export async function backfillBalanceSheets(): Promise<{
  ok: boolean;
  pulled: number;
  errors: string[];
}> {
  const user = await requireDirector();
  const now = new Date();
  const toMonth = now.getMonth() + 1;
  const toYear = now.getFullYear();
  return pullXeroBalanceSheetRange(7, 2025, toMonth, toYear, user.id);
}
