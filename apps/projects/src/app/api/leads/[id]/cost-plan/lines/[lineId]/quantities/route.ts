import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import Decimal from 'decimal.js';

// PUT /api/leads/[id]/cost-plan/lines/[lineId]/quantities
// Body: { label: string; quantity: number }[]
// label = area name (or any label). Replaces all quantity records for this line matching each label.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; lineId: string }> }) {
  const { id, lineId } = await params;
  const user = await requireAppUser();

  const line = await prisma.estimateLine.findFirst({
    where: { id: lineId, estimate: { id, organisationId: user.organisationId } },
    include: { quantities: true },
  });
  if (!line) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json() as { label: string; quantity: number }[];

  // Upsert each qty record by lineId + label
  await Promise.all(
    body.map(async ({ label, quantity }) => {
      const existing = line.quantities.find((q) => q.label === label);
      if (existing) {
        if (quantity === 0) {
          await prisma.estimateLineQuantity.delete({ where: { id: existing.id } });
        } else {
          await prisma.estimateLineQuantity.update({
            where: { id: existing.id },
            data: { quantity },
          });
        }
      } else if (quantity !== 0) {
        await prisma.estimateLineQuantity.create({
          data: { lineId, label, quantity },
        });
      }
    })
  );

  // Recalculate line total from updated quantities
  const allQtys = await prisma.estimateLineQuantity.findMany({ where: { lineId } });
  const totalQty = allQtys.reduce((s, q) => s.plus(new Decimal(q.quantity.toString())), new Decimal(0));
  const rate = new Decimal(line.rate.toString());
  const total = totalQty.mul(rate);

  const updated = await prisma.estimateLine.update({
    where: { id: lineId },
    data: {
      quantity: totalQty.toDecimalPlaces(4).toNumber(),
      total: total.toDecimalPlaces(2).toNumber(),
    },
    include: { quantities: true },
  });

  return NextResponse.json({
    ...updated,
    quantity: Number(updated.quantity),
    rate: Number(updated.rate),
    total: Number(updated.total),
    markupPct: updated.markupPct != null ? Number(updated.markupPct) : null,
    quantities: updated.quantities.map((q) => ({ ...q, quantity: Number(q.quantity) })),
  });
}
