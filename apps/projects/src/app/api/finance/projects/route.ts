import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json();
  const {
    reportMonth, jobNumber, projectName, status, practicalCompletionDate,
    forecastContractValue, forecastFinalCosts, riskAndOpportunity,
    forecastMarginDollars, forecastMarginPercent, targetExitMarginPercent,
    claimTotal, claimRetention, subClaims, subRetention,
    creditors, labour, totalCost, wip, notes,
  } = body;

  const record = await prisma.financeProject.create({
    data: {
      organisationId: user.organisationId,
      reportMonth: new Date(reportMonth),
      jobNumber,
      projectName,
      status,
      practicalCompletionDate: practicalCompletionDate ? new Date(practicalCompletionDate) : null,
      forecastContractValue: forecastContractValue || '0',
      forecastFinalCosts: forecastFinalCosts || '0',
      riskAndOpportunity: riskAndOpportunity || '0',
      forecastMarginDollars: forecastMarginDollars || '0',
      forecastMarginPercent: forecastMarginPercent || '0',
      targetExitMarginPercent: targetExitMarginPercent ?? null,
      claimTotal: claimTotal || '0',
      claimRetention: claimRetention || '0',
      subClaims: subClaims || '0',
      subRetention: subRetention || '0',
      creditors: creditors || '0',
      labour: labour || '0',
      totalCost: totalCost || '0',
      wip: wip || '0',
      notes: notes || null,
    },
  });

  return NextResponse.json(record);
}
