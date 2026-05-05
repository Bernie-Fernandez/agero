import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json();
  const {
    jobNumber, projectName, status, practicalCompletionDate,
    forecastContractValue, forecastFinalCosts, riskAndOpportunity,
    forecastMarginDollars, forecastMarginPercent, targetExitMarginPercent,
    claimTotal, claimRetention, subClaims, subRetention,
    creditors, labour, totalCost, wip, notes,
  } = body;

  const record = await prisma.financeProject.updateMany({
    where: { id, organisationId: user.organisationId, deletedAt: null },
    data: {
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

  if (record.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.financeProject.findUnique({ where: { id } });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  await prisma.financeProject.updateMany({
    where: { id, organisationId: user.organisationId },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
