import { prisma } from '@/lib/prisma';
import { requireDirector } from '@/lib/auth';
import { notFound } from 'next/navigation';
import ReportViewClient from './ReportViewClient';
import {
  calcBusinessUnitSummary,
  calcConsolidatedPnL,
  calcWIPSchedule,
  calcProjectFinancialSummary,
  calcUnsecuredForecast,
} from '@/lib/finance/calculations';

export default async function ReportViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireDirector();

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
  if (!report) notFound();

  const reportMonth = report.reportMonth;
  const [busUnit, pnl, wipSchedule, unsecured] = await Promise.all([
    calcBusinessUnitSummary(user.organisationId, reportMonth),
    calcConsolidatedPnL(user.organisationId, reportMonth),
    calcWIPSchedule(user.organisationId, reportMonth),
    calcUnsecuredForecast(user.organisationId, reportMonth),
  ]);
  const projectSummary = await calcProjectFinancialSummary(user.organisationId, reportMonth, wipSchedule);

  return (
    <ReportViewClient
      report={JSON.parse(JSON.stringify(report))}
      calculations={JSON.parse(JSON.stringify({ busUnit, pnl, wipSchedule, projectSummary, unsecured }))}
    />
  );
}
