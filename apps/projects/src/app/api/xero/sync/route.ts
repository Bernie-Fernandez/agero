import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { firstDay, syncXeroMonth } from '@/lib/xero/month-sync';

export async function POST(req: NextRequest) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await req.json();
  const { report_month } = body as { report_month: string };
  if (!report_month) {
    return NextResponse.json({ error: 'report_month is required (YYYY-MM-DD)' }, { status: 400 });
  }

  const reportDate = new Date(report_month);
  if (Number.isNaN(reportDate.getTime())) {
    return NextResponse.json({ error: 'report_month must be a valid date (YYYY-MM-DD)' }, { status: 400 });
  }
  const monthKey = firstDay(reportDate);

  const gate = await prisma.monthEndStatus.findUnique({
    where: { organisationId_reportMonth: { organisationId: user.organisationId, reportMonth: monthKey } },
  });
  // READY = first sync. SYNCED = re-sync (e.g. after late Xero adjustments, or to
  // correct a bad earlier pull). LOCKED and OPEN months are never touched.
  if (!gate || (gate.status !== 'READY' && gate.status !== 'SYNCED')) {
    return NextResponse.json(
      { error: 'Month must be marked as READY before syncing Xero.' },
      { status: 400 }
    );
  }

  const result = await syncXeroMonth(user.organisationId, monthKey);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await prisma.monthEndStatus.update({
    where: { organisationId_reportMonth: { organisationId: user.organisationId, reportMonth: monthKey } },
    data: { status: 'SYNCED', xeroSyncedAt: new Date() },
  });

  // Record what the P&L actually contained. Nothing else persists the Xero
  // report, so without this a field that syncs as 0.00 cannot be told apart
  // from an account that has been renamed in Xero.
  await createAuditLog({
    userId: user.id,
    action: 'MONTH_STATUS_XERO_SYNCED',
    entity: 'MonthEndStatus',
    entityId: gate.id,
    detail: {
      report_month: monthKey.toISOString().split('T')[0],
      revenue: result.summary.revenue,
      net_profit: result.summary.netProfit,
      direct_labour: result.summary.directLabour,
      indirect_labour: result.summary.indirectLabour,
      marketing_expenses: result.summary.marketingExpenses,
      resolution: result.summary.resolution,
      direct_labour_accounts: result.summary.directLabourAccounts,
      indirect_labour_accounts: result.summary.indirectLabourAccounts,
      marketing_accounts: result.summary.marketingAccounts,
      pnl_account_lines: result.summary.accountLines,
    },
  });

  return NextResponse.json({ ok: true, summary: result.summary });
}
