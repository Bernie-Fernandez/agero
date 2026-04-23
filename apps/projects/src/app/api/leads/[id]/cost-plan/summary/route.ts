import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import Decimal from 'decimal.js';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAppUser();

  const estimate = await prisma.estimate.findFirst({
    where: { id, organisationId: user.organisationId },
    select: { defaultMarkupPct: true, costRecoveryPct: true, targetGpPct: true, minGpPct: true },
  });
  if (!estimate) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const lines = await prisma.estimateLine.findMany({
    where: { estimateId: id },
    select: { total: true, markupPct: true, isOption: true, isLockaway: true, isHidden: true, tradeSectionId: true },
  });

  const activeLines = lines.filter((l) => !l.isOption && !l.isLockaway && !l.isHidden);
  const totalCost = activeLines.reduce((s, l) => s.plus(new Decimal(l.total.toString())), new Decimal(0));

  const totalSell = activeLines.reduce((s, l) => {
    const markup = l.markupPct != null
      ? new Decimal(l.markupPct.toString()).div(100)
      : new Decimal(estimate.defaultMarkupPct.toString()).div(100);
    return s.plus(new Decimal(l.total.toString()).mul(new Decimal(1).plus(markup)));
  }, new Decimal(0));

  const grossRevenue = totalSell.mul(new Decimal(1).plus(new Decimal(estimate.costRecoveryPct.toString()).div(100)));
  const gpPct = grossRevenue.gt(0)
    ? grossRevenue.minus(totalCost).div(grossRevenue).mul(100)
    : new Decimal(0);

  const sectionBreakdown = await prisma.estimateTradeSection.findMany({
    where: { estimateId: id },
    select: { id: true, name: true, code: true },
    orderBy: { order: 'asc' },
  });

  return NextResponse.json({
    totalCost: totalCost.toFixed(2),
    totalSell: totalSell.toFixed(2),
    grossRevenue: grossRevenue.toFixed(2),
    gpPct: gpPct.toFixed(2),
    targetGpPct: estimate.targetGpPct.toString(),
    minGpPct: estimate.minGpPct?.toString() ?? null,
    lineCount: lines.length,
    sections: sectionBreakdown,
  });
}
