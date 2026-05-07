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
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { ManagementReportPDF } from '@/components/finance/ManagementReportPDF';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const report = await prisma.managementReport.findFirst({
    where: { id, organisationId: user.organisationId },
    include: {
      preparedBy: { select: { firstName: true, lastName: true } },
      sections: true,
      wipEntries: {
        include: { financeProject: { select: { jobNumber: true, projectName: true, status: true } } },
      },
    },
  });
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const reportMonth = report.reportMonth;
  const [busUnit, pnl, wipSchedule, unsecured] = await Promise.all([
    calcBusinessUnitSummary(user.organisationId, reportMonth),
    calcConsolidatedPnL(user.organisationId, reportMonth),
    calcWIPSchedule(user.organisationId, reportMonth),
    calcUnsecuredForecast(user.organisationId, reportMonth),
  ]);
  const projectSummary = await calcProjectFinancialSummary(user.organisationId, reportMonth, wipSchedule);

  const data = JSON.parse(JSON.stringify({ report, calculations: { busUnit, pnl, wipSchedule, projectSummary, unsecured } }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(createElement(ManagementReportPDF, { data }) as any);

  const monthStr = reportMonth.toISOString().slice(0, 7);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Agero_Management_Report_${monthStr}.pdf"`,
    },
  });
}
