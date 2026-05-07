import { NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ORG_ID = 'a1000000-0000-0000-0000-000000000001';
const MARCH_2026 = new Date('2026-03-01');

export async function POST() {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const orgId = user.organisationId;

  // Step 1: Seed MonthEndStatus for March 2026 as SYNCED
  await prisma.monthEndStatus.upsert({
    where: { organisationId_reportMonth: { organisationId: orgId, reportMonth: MARCH_2026 } },
    update: { status: 'SYNCED', notes: 'Seeded from March 2026 Excel — awaiting live Xero connection.', xeroSyncedAt: new Date() },
    create: {
      organisationId: orgId,
      reportMonth: MARCH_2026,
      status: 'SYNCED',
      notes: 'Seeded from March 2026 Excel — awaiting live Xero connection.',
      xeroSyncedAt: new Date(),
    },
  });

  // Step 2: Seed AnnualBudget FY budget line items for Awarded and Backlog margins
  for (const { lineItem, total, displayOrder } of [
    { lineItem: 'Awarded Projects Margin Budget', total: '1703244.46', displayOrder: 900 },
    { lineItem: 'Backlog Projects Margin Budget', total: '248531.54', displayOrder: 901 },
  ]) {
    const existing = await prisma.annualBudget.findFirst({
      where: { organisationId: orgId, financialYear: 2026, lineItem },
    });
    if (existing) {
      await prisma.annualBudget.update({ where: { id: existing.id }, data: { total } });
    } else {
      await prisma.annualBudget.create({
        data: { organisationId: orgId, financialYear: 2026, category: 'GROSS_MARGIN', lineItem, total, displayOrder },
      });
    }
  }

  // Step 3: Seed XeroPnL manually-entered fields for March 2026
  await prisma.xeroPnL.upsert({
    where: { organisationId_reportMonth: { organisationId: orgId, reportMonth: MARCH_2026 } },
    update: {
      awardedGrossProfitYtd: '668338.08',
      awardedRevenueYtd: '2468563.96',
      backlogGrossProfitYtd: '598262.99',
      backlogRevenueYtd: '1301223.14',
      netProjectCashFlow: '1128241.58',
      awardedYtdBudgetMargin: '500009.46',
      backlogYtdBudgetMargin: '248531.54',
    },
    create: {
      organisationId: orgId,
      reportMonth: MARCH_2026,
      awardedGrossProfitYtd: '668338.08',
      awardedRevenueYtd: '2468563.96',
      backlogGrossProfitYtd: '598262.99',
      backlogRevenueYtd: '1301223.14',
      netProjectCashFlow: '1128241.58',
      awardedYtdBudgetMargin: '500009.46',
      backlogYtdBudgetMargin: '248531.54',
    },
  });

  return NextResponse.json({
    ok: true,
    message: 'Seed complete for March 2026.',
    seeded: {
      monthEndStatus: 'SYNCED',
      annualBudget: {
        awardedFyBudget: 1703244.46,
        backlogFyBudget: 248531.54,
      },
      xeroPnL: {
        awardedGrossProfitYtd: 668338.08,
        awardedRevenueYtd: 2468563.96,
        backlogGrossProfitYtd: 598262.99,
        backlogRevenueYtd: 1301223.14,
        netProjectCashFlow: 1128241.58,
        awardedYtdBudgetMargin: 500009.46,
        backlogYtdBudgetMargin: 248531.54,
      },
    },
  });
}
