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

  return NextResponse.json({
    ok: true,
    message: 'MonthEndStatus for March 2026 seeded as SYNCED. Upload Management_Report.xlsx to seed financial figures.',
    note: 'The Management_Report.xlsx file was not found. Please upload it and re-run the seed to populate FinanceProject, XeroPnL, XeroBankBalance, AnnualBudget, and SecuredForecast records.',
  });
}
