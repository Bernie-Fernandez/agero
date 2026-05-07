import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  calcBusinessUnitSummary,
  calcConsolidatedPnL,
  calcWIPSchedule,
  calcProjectFinancialSummary,
  calcUnsecuredForecast,
} from '@/lib/finance/calculations';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const report = await prisma.managementReport.findFirst({
    where: { id, organisationId: user.organisationId },
    include: {
      preparedBy: { select: { firstName: true, lastName: true } },
      finalisedBy: { select: { firstName: true, lastName: true } },
      sections: true,
      wipEntries: {
        include: { financeProject: { select: { jobNumber: true, projectName: true, status: true } } },
      },
    },
  });
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Run all calculation engines fresh
  const reportMonth = report.reportMonth;
  const [busUnit, pnl, wipSchedule, unsecured] = await Promise.all([
    calcBusinessUnitSummary(user.organisationId, reportMonth),
    calcConsolidatedPnL(user.organisationId, reportMonth),
    calcWIPSchedule(user.organisationId, reportMonth),
    calcUnsecuredForecast(user.organisationId, reportMonth),
  ]);
  const projectSummary = await calcProjectFinancialSummary(user.organisationId, reportMonth, wipSchedule);

  return NextResponse.json(
    JSON.parse(JSON.stringify({
      report,
      calculations: { busUnit, pnl, wipSchedule, projectSummary, unsecured },
    }))
  );
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { status } = await req.json();

  const report = await prisma.managementReport.findFirst({
    where: { id, organisationId: user.organisationId },
  });
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (report.status === 'FINAL') {
    return NextResponse.json({ error: 'FINAL reports cannot be modified' }, { status: 400 });
  }

  const updateData: Record<string, unknown> = { status };
  if (status === 'REVIEW') updateData.reviewedAt = new Date();
  if (status === 'FINAL') {
    updateData.finalisedAt = new Date();
    updateData.finalisedById = user.id;
    // Lock the month-end status
    await prisma.monthEndStatus.upsert({
      where: { organisationId_reportMonth: { organisationId: user.organisationId, reportMonth: report.reportMonth } },
      create: {
        organisationId: user.organisationId,
        reportMonth: report.reportMonth,
        status: 'LOCKED',
        lockedAt: new Date(),
      },
      update: { status: 'LOCKED', lockedAt: new Date() },
    });
  }

  const updated = await prisma.managementReport.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(JSON.parse(JSON.stringify(updated)));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Regenerate WIP calculations for this report
  const { id } = await params;
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const report = await prisma.managementReport.findFirst({
    where: { id, organisationId: user.organisationId },
  });
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (report.status === 'FINAL') return NextResponse.json({ error: 'FINAL reports cannot be regenerated' }, { status: 400 });

  const wipEntries = await calcWIPSchedule(user.organisationId, report.reportMonth);
  for (const w of wipEntries) {
    await prisma.wIPSchedule.upsert({
      where: {
        managementReportId_financeProjectId: {
          managementReportId: id,
          financeProjectId: w.financeProjectId,
        },
      },
      create: {
        organisationId: user.organisationId,
        financeProjectId: w.financeProjectId,
        managementReportId: id,
        reportMonth: report.reportMonth,
        contractValue: w.contractValue,
        estimatedTotalCost: w.estimatedTotalCost,
        costsToDate: w.costsToDate,
        costToComplete: w.costToComplete,
        pctComplete: w.pctComplete,
        earnedRevenue: w.earnedRevenue,
        billedToDate: w.billedToDate,
        overbilledUnderbilled: w.overbilledUnderbilled,
        estimatedGrossProfit: w.estimatedGrossProfit,
        estimatedGpPct: w.estimatedGpPct,
        flag: w.flag,
        flagReason: w.flagReason,
        costToCompleteEstimated: w.costToCompleteEstimated,
      },
      update: {
        contractValue: w.contractValue,
        estimatedTotalCost: w.estimatedTotalCost,
        costsToDate: w.costsToDate,
        costToComplete: w.costToComplete,
        pctComplete: w.pctComplete,
        earnedRevenue: w.earnedRevenue,
        billedToDate: w.billedToDate,
        overbilledUnderbilled: w.overbilledUnderbilled,
        estimatedGrossProfit: w.estimatedGrossProfit,
        estimatedGpPct: w.estimatedGpPct,
        flag: w.flag,
        flagReason: w.flagReason,
        costToCompleteEstimated: w.costToCompleteEstimated,
      },
    });
  }

  return NextResponse.json({ ok: true, wipEntriesUpdated: wipEntries.length });
}
