import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  calcWIPSchedule,
} from '@/lib/finance/calculations';

export async function GET(_req: NextRequest) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const reports = await prisma.managementReport.findMany({
    where: { organisationId: user.organisationId },
    orderBy: { reportMonth: 'desc' },
    include: {
      preparedBy: { select: { firstName: true, lastName: true } },
      _count: { select: { sections: true } },
    },
  });

  return NextResponse.json(JSON.parse(JSON.stringify(reports)));
}

export async function POST(req: NextRequest) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { reportMonth } = await req.json();
  if (!reportMonth) return NextResponse.json({ error: 'Missing reportMonth' }, { status: 400 });

  const month = new Date(reportMonth);

  // Check if report already exists for this month
  const existing = await prisma.managementReport.findFirst({
    where: { organisationId: user.organisationId, reportMonth: month },
  });
  if (existing) {
    // Return existing report (regenerate will be handled separately)
    return NextResponse.json(JSON.parse(JSON.stringify(existing)));
  }

  // Create new report
  const report = await prisma.managementReport.create({
    data: {
      organisationId: user.organisationId,
      reportMonth: month,
      preparedById: user.id,
      status: 'DRAFT',
    },
  });

  // Run WIP calculations and save
  try {
    const wipEntries = await calcWIPSchedule(user.organisationId, month);
    for (const w of wipEntries) {
      await prisma.wIPSchedule.upsert({
        where: {
          managementReportId_financeProjectId: {
            managementReportId: report.id,
            financeProjectId: w.financeProjectId,
          },
        },
        create: {
          organisationId: user.organisationId,
          financeProjectId: w.financeProjectId,
          managementReportId: report.id,
          reportMonth: month,
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
  } catch {
    // WIP calc failure should not block report creation
  }

  return NextResponse.json(JSON.parse(JSON.stringify(report)));
}
