import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import Decimal from 'decimal.js';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAppUser();

  const estimate = await prisma.estimate.findFirst({
    where: { id, organisationId: user.organisationId },
    select: {
      id: true,
      defaultMarkupPct: true,
      costRecoveryPct: true,
      targetGpPct: true,
      minGpPct: true,
      budgetCoverageTarget: true,
    },
  });
  if (!estimate) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [sections, areas, lines] = await Promise.all([
    prisma.estimateTradeSection.findMany({
      where: { estimateId: id },
      orderBy: { order: 'asc' },
    }),
    prisma.estimateArea.findMany({
      where: { estimateId: id },
      orderBy: { order: 'asc' },
    }),
    prisma.estimateLine.findMany({
      where: { estimateId: id },
      include: {
        quantities: true,
        tradeSection: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ tradeSectionId: 'asc' }, { order: 'asc' }],
    }),
  ]);

  const defaultMarkup = new Decimal(estimate.defaultMarkupPct.toString());

  const enrichedLines = lines.map((l) => {
    const totalQty = l.quantities.length > 0
      ? l.quantities.reduce((s, q) => s.plus(new Decimal(q.quantity.toString())), new Decimal(0))
      : new Decimal(l.quantity.toString());
    const rate = new Decimal(l.rate.toString());
    const totalCost = totalQty.mul(rate);
    const markup = l.markupPct != null ? new Decimal(l.markupPct.toString()) : defaultMarkup;
    const totalSell = totalCost.mul(new Decimal(1).plus(markup.div(100)));
    const gpPct = totalSell.gt(0) ? totalSell.minus(totalCost).div(totalSell).mul(100) : new Decimal(0);
    return {
      ...l,
      quantity: Number(l.quantity),
      rate: Number(l.rate),
      total: Number(l.total),
      markupPct: l.markupPct != null ? Number(l.markupPct) : null,
      declaredMarginPct: l.declaredMarginPct != null ? Number(l.declaredMarginPct) : null,
      quantities: l.quantities.map((q) => ({ ...q, quantity: Number(q.quantity) })),
      _calc: {
        totalQty: totalQty.toFixed(4),
        totalCost: totalCost.toFixed(2),
        totalSell: totalSell.toFixed(2),
        gpPct: gpPct.toFixed(2),
      },
    };
  });

  const enrichedSections = sections.map((s) => {
    const sLines = enrichedLines.filter(
      (l) => l.tradeSectionId === s.id &&
        (l.lineStructure === 'STANDARD_LINE' || l.lineStructure === 'PROJECT_SUM_LINE') &&
        !l.isOption && !l.isLockaway && !l.isHidden
    );
    const subtotalCost = sLines.reduce((sum, l) => sum.plus(new Decimal(l._calc.totalCost)), new Decimal(0));
    const subtotalSell = sLines.reduce((sum, l) => sum.plus(new Decimal(l._calc.totalSell)), new Decimal(0));
    const subtotalGpPct = subtotalSell.gt(0)
      ? subtotalSell.minus(subtotalCost).div(subtotalSell).mul(100).toFixed(2)
      : '0.00';
    return {
      ...s,
      subtotalCost: subtotalCost.toFixed(2),
      subtotalSell: subtotalSell.toFixed(2),
      subtotalGpPct,
      lines: enrichedLines.filter((l) => l.tradeSectionId === s.id),
    };
  });

  const activeLines = enrichedLines.filter(
    (l) => (l.lineStructure === 'STANDARD_LINE' || l.lineStructure === 'PROJECT_SUM_LINE') &&
      !l.isOption && !l.isLockaway && !l.isHidden
  );
  const totalCost = activeLines.reduce((s, l) => s.plus(new Decimal(l._calc.totalCost)), new Decimal(0));
  const totalSell = activeLines.reduce((s, l) => s.plus(new Decimal(l._calc.totalSell)), new Decimal(0));
  const costRecovery = new Decimal(estimate.costRecoveryPct.toString()).div(100);
  const grossRevenue = totalSell.mul(new Decimal(1).plus(costRecovery));
  const gpPct = grossRevenue.gt(0) ? grossRevenue.minus(totalCost).div(grossRevenue).mul(100) : new Decimal(0);

  return NextResponse.json({
    sections: enrichedSections,
    areas,
    summary: {
      totalCost: totalCost.toFixed(2),
      totalSell: totalSell.toFixed(2),
      grossRevenue: grossRevenue.toFixed(2),
      gpPct: gpPct.toFixed(2),
      targetGpPct: estimate.targetGpPct.toString(),
      minGpPct: estimate.minGpPct?.toString() ?? '0',
    },
  });
}
