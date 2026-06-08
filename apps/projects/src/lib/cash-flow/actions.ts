'use server';

import { requireFinanceAccess } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getBudgetTotals } from '@/lib/revenue-budget/actions';
import type { CashFlowCategory, CashFlowDirection } from '@agero/db';
import { CATEGORY_DIRECTION } from './constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CashFlowForecastSettings = {
  id: string;
  openingBalance: number;
  minimumCash: number;
  arCollectionDays: number;
  apPaymentDays: number;
};

export type CashFlowLineItemRow = {
  id: string;
  category: CashFlowCategory;
  description: string;
  amount: number;
  direction: CashFlowDirection;
  periodDate: string;
  isRecurring: boolean;
  recurringFrequency: string | null;
  notes: string | null;
};

export type CashFlowPageData = {
  forecast: CashFlowForecastSettings;
  lineItems: CashFlowLineItemRow[];
  bsCashBalance: number;
  bsARBalance: number;
  bsAPBalance: number;
  bsDate: string | null;
  budgetTotals: Record<string, number>;
  overheadMonthlyAvg: number;
  directCostPct: number;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

// FY27 anchor: July 1 2026
function getForecastMonth(): Date {
  return new Date(Date.UTC(2026, 6, 1)); // 2026-07-01
}

// ─── Main data loader ─────────────────────────────────────────────────────────

export async function getCashFlowPageData(): Promise<{ ok: boolean; data?: CashFlowPageData; error?: string }> {
  const user = await requireFinanceAccess();
  const orgId = user.organisationId;

  try {
    // 1. Latest balance sheet (prefer locked month, fall back to any)
    const [lockedMonth, latestBS, pnlSnapshots] = await Promise.all([
      prisma.monthEndStatus.findFirst({
        where: { organisationId: orgId, status: 'LOCKED' },
        orderBy: { reportMonth: 'desc' },
        select: { reportMonth: true },
      }),
      prisma.xeroBalanceSheetSnapshot.findFirst({
        where: { organisationId: orgId },
        orderBy: { reportMonth: 'desc' },
        select: { cashAndBankBalances: true, accountsReceivable: true, accountsPayable: true, snapshotDate: true, reportMonth: true },
      }),
      prisma.xeroPnLSnapshot.findMany({
        where: { organisationId: orgId },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 3,
        select: { totalExpenses: true, totalIncome: true, grossProfit: true },
      }),
    ]);

    // If there's a locked month, prefer that BS snapshot
    let bsSnap = latestBS;
    if (lockedMonth) {
      const lockedBS = await prisma.xeroBalanceSheetSnapshot.findFirst({
        where: {
          organisationId: orgId,
          reportMonth: { lte: lockedMonth.reportMonth },
        },
        orderBy: { reportMonth: 'desc' },
        select: { cashAndBankBalances: true, accountsReceivable: true, accountsPayable: true, snapshotDate: true, reportMonth: true },
      });
      if (lockedBS) bsSnap = lockedBS;
    }

    const bsCashBalance = Number(bsSnap?.cashAndBankBalances ?? 0);
    const bsARBalance = Number(bsSnap?.accountsReceivable ?? 0);
    const bsAPBalance = Number(bsSnap?.accountsPayable ?? 0);
    const bsDate = bsSnap?.snapshotDate ? JSON.parse(JSON.stringify(bsSnap.snapshotDate)) : null;

    // 2. Get or create the CashFlowForecast settings record
    const forecastMonth = getForecastMonth();
    let forecast = await prisma.cashFlowForecast.findUnique({
      where: { organisationId_forecastMonth: { organisationId: orgId, forecastMonth } },
      include: { lineItems: { orderBy: { periodDate: 'asc' } } },
    });

    if (!forecast) {
      forecast = await prisma.cashFlowForecast.create({
        data: {
          organisationId: orgId,
          forecastMonth,
          openingBalance: bsCashBalance.toFixed(2),
          minimumCash: '0',
          arCollectionDays: 21,
          apPaymentDays: 30,
        },
        include: { lineItems: { orderBy: { periodDate: 'asc' } } },
      });
    }

    // 3. Budget totals for FY27
    const budgetResult = await getBudgetTotals('FY27');
    const budgetTotals: Record<string, number> = {};
    if (budgetResult.ok && budgetResult.totals) {
      for (const [k, v] of Object.entries(budgetResult.totals)) {
        budgetTotals[k] = Number(v);
      }
    }

    // 4. P&L averages for overhead and direct cost %
    const overheadMonthlyAvg = pnlSnapshots.length > 0
      ? pnlSnapshots.reduce((s, r) => s + Number(r.totalExpenses), 0) / pnlSnapshots.length
      : 0;
    const avgRevenue = pnlSnapshots.length > 0
      ? pnlSnapshots.reduce((s, r) => s + Number(r.totalIncome), 0) / pnlSnapshots.length
      : 0;
    const avgGrossProfit = pnlSnapshots.length > 0
      ? pnlSnapshots.reduce((s, r) => s + Number(r.grossProfit), 0) / pnlSnapshots.length
      : 0;
    const directCostPct = avgRevenue > 0 ? 1 - (avgGrossProfit / avgRevenue) : 0.65;

    const lineItems: CashFlowLineItemRow[] = forecast.lineItems.map((li) => ({
      id: li.id,
      category: li.category,
      description: li.description,
      amount: Number(li.amount),
      direction: li.direction,
      periodDate: JSON.parse(JSON.stringify(li.periodDate)),
      isRecurring: li.isRecurring,
      recurringFrequency: li.recurringFrequency,
      notes: li.notes,
    }));

    return {
      ok: true,
      data: {
        forecast: {
          id: forecast.id,
          openingBalance: bsCashBalance, // always use live BS balance
          minimumCash: Number(forecast.minimumCash),
          arCollectionDays: forecast.arCollectionDays,
          apPaymentDays: forecast.apPaymentDays,
        },
        lineItems,
        bsCashBalance,
        bsARBalance,
        bsAPBalance,
        bsDate,
        budgetTotals,
        overheadMonthlyAvg,
        directCostPct,
      },
    };
  } catch (e) {
    console.error('[cash-flow] getCashFlowPageData error:', e);
    return { ok: false, error: 'Failed to load cash flow data.' };
  }
}

// ─── Settings update ───────────────────────────────────────────────────────────

export async function updateForecastSettings(input: {
  forecastId: string;
  minimumCash: number;
  arCollectionDays: number;
  apPaymentDays: number;
}): Promise<{ ok: boolean; error?: string }> {
  await requireFinanceAccess();
  try {
    await prisma.cashFlowForecast.update({
      where: { id: input.forecastId },
      data: {
        minimumCash: input.minimumCash.toFixed(2),
        arCollectionDays: input.arCollectionDays,
        apPaymentDays: input.apPaymentDays,
      },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: 'Failed to save settings.' };
  }
}

// ─── Line item CRUD ────────────────────────────────────────────────────────────

export async function addLineItems(
  forecastId: string,
  items: {
    category: CashFlowCategory;
    description: string;
    amount: number;
    periodDate: string; // ISO date
    isRecurring: boolean;
    recurringFrequency: string | null;
    notes: string | null;
  }[],
): Promise<{ ok: boolean; items?: CashFlowLineItemRow[]; error?: string }> {
  await requireFinanceAccess();
  try {
    const created = await prisma.$transaction(
      items.map((item) =>
        prisma.cashFlowLineItem.create({
          data: {
            cashFlowForecastId: forecastId,
            category: item.category,
            description: item.description,
            amount: item.amount.toFixed(2),
            direction: CATEGORY_DIRECTION[item.category],
            periodDate: new Date(item.periodDate),
            isRecurring: item.isRecurring,
            recurringFrequency: item.recurringFrequency,
            notes: item.notes,
          },
        }),
      ),
    );

    return {
      ok: true,
      items: created.map((li) => ({
        id: li.id,
        category: li.category,
        description: li.description,
        amount: Number(li.amount),
        direction: li.direction,
        periodDate: JSON.parse(JSON.stringify(li.periodDate)),
        isRecurring: li.isRecurring,
        recurringFrequency: li.recurringFrequency,
        notes: li.notes,
      })),
    };
  } catch (e) {
    console.error('[cash-flow] addLineItems error:', e);
    return { ok: false, error: 'Failed to add line items.' };
  }
}

export async function updateLineItem(
  id: string,
  input: { description?: string; amount?: number; notes?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  await requireFinanceAccess();
  try {
    await prisma.cashFlowLineItem.update({
      where: { id },
      data: {
        ...(input.description !== undefined && { description: input.description }),
        ...(input.amount !== undefined && { amount: input.amount.toFixed(2) }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: 'Failed to update line item.' };
  }
}

export async function deleteLineItem(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireFinanceAccess();
  try {
    await prisma.cashFlowLineItem.delete({ where: { id } });
    return { ok: true };
  } catch {
    return { ok: false, error: 'Failed to delete line item.' };
  }
}
