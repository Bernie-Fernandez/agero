import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
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

  return NextResponse.json({ ok: true, summary: result.summary });
}
