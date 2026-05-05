import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import Decimal from 'decimal.js';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAppUser();
  const estimate = await prisma.estimate.findFirst({
    where: { id, organisationId: user.organisationId },
    select: { id: true },
  });
  if (!estimate) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const lines = await prisma.estimateLine.findMany({
    where: { estimateId: id },
    include: { tradeSection: { select: { id: true, name: true, code: true } } },
    orderBy: [{ tradeSectionId: 'asc' }, { order: 'asc' }],
  });
  return NextResponse.json(lines);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAppUser();
  const estimate = await prisma.estimate.findFirst({
    where: { id, organisationId: user.organisationId },
    select: { id: true },
  });
  if (!estimate) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const qty = new Decimal(body.quantity ?? 0);
  const rate = new Decimal(body.rate ?? 0);
  const total = qty.mul(rate);
  const count = await prisma.estimateLine.count({ where: { estimateId: id } });

  const line = await prisma.estimateLine.create({
    data: {
      estimateId: id,
      tradeSectionId: body.tradeSectionId || undefined,
      lineStructure: body.lineStructure ?? 'STANDARD_LINE',
      lineCode: body.lineCode || null,
      description: body.description ?? '',
      type: body.type ?? 'MATERIAL',
      quantity: qty.toDecimalPlaces(4).toNumber(),
      unit: body.unit || null,
      rate: rate.toDecimalPlaces(4).toNumber(),
      total: total.toDecimalPlaces(2).toNumber(),
      markupPct: body.markupPct != null ? new Decimal(body.markupPct).toDecimalPlaces(2).toNumber() : null,
      declaredMarginPct: body.declaredMarginPct != null ? new Decimal(body.declaredMarginPct).toDecimalPlaces(2).toNumber() : null,
      tradePackageId: body.tradePackageId || undefined,
      isRisk: body.isRisk ?? false,
      isOption: body.isOption ?? false,
      isPcSum: body.isPcSum ?? false,
      isLockaway: body.isLockaway ?? false,
      isHidden: body.isHidden ?? false,
      notes: body.notes || null,
      order: body.order ?? count,
    },
    include: { tradeSection: { select: { id: true, name: true, code: true } } },
  });
  return NextResponse.json(line, { status: 201 });
}
