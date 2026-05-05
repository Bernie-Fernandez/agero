import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import Decimal from 'decimal.js';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; lineId: string }> }) {
  const { id, lineId } = await params;
  const user = await requireAppUser();
  const line = await prisma.estimateLine.findFirst({
    where: { id: lineId, estimate: { id, organisationId: user.organisationId } },
  });
  if (!line) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const qty = body.quantity != null ? new Decimal(body.quantity) : new Decimal(line.quantity.toString());
  const rate = body.rate != null ? new Decimal(body.rate) : new Decimal(line.rate.toString());
  const total = qty.mul(rate);

  const updated = await prisma.estimateLine.update({
    where: { id: lineId },
    data: {
      description: body.description ?? line.description,
      lineCode: 'lineCode' in body ? (body.lineCode || null) : line.lineCode,
      type: body.type ?? line.type,
      quantity: qty.toDecimalPlaces(4).toNumber(),
      unit: 'unit' in body ? (body.unit || null) : line.unit,
      rate: rate.toDecimalPlaces(4).toNumber(),
      total: total.toDecimalPlaces(2).toNumber(),
      markupPct: 'markupPct' in body
        ? (body.markupPct != null ? new Decimal(body.markupPct).toDecimalPlaces(2).toNumber() : null)
        : line.markupPct != null ? new Decimal(line.markupPct.toString()).toDecimalPlaces(2).toNumber() : null,
      declaredMarginPct: 'declaredMarginPct' in body
        ? (body.declaredMarginPct != null ? new Decimal(body.declaredMarginPct).toDecimalPlaces(2).toNumber() : null)
        : line.declaredMarginPct != null ? new Decimal(line.declaredMarginPct.toString()).toDecimalPlaces(2).toNumber() : null,
      tradePackageId: 'tradePackageId' in body ? (body.tradePackageId || undefined) : line.tradePackageId ?? undefined,
      isRisk: body.isRisk ?? line.isRisk,
      isOption: body.isOption ?? line.isOption,
      isPcSum: body.isPcSum ?? line.isPcSum,
      isLockaway: body.isLockaway ?? line.isLockaway,
      isHidden: body.isHidden ?? line.isHidden,
      notes: 'notes' in body ? (body.notes || null) : line.notes,
      order: body.order ?? line.order,
    },
    include: { tradeSection: { select: { id: true, name: true, code: true } } },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; lineId: string }> }) {
  const { id, lineId } = await params;
  const user = await requireAppUser();
  const line = await prisma.estimateLine.findFirst({
    where: { id: lineId, estimate: { id, organisationId: user.organisationId } },
  });
  if (!line) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.estimateLine.delete({ where: { id: lineId } });
  return new NextResponse(null, { status: 204 });
}
