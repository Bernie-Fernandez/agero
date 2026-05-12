import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAppUser();
  const { id: estimateId } = await params;
  const ageroRef = req.nextUrl.searchParams.get('ageroRef');

  if (!ageroRef) return NextResponse.json({ error: 'ageroRef required' }, { status: 400 });

  const refItem = await prisma.referenceLibraryItem.findFirst({
    where: { ageroRef, organisationId: user.organisationId },
    include: {
      buildUps: { orderBy: { sortOrder: 'asc' } },
      rates: { where: { rateType: 'standard' }, take: 1 },
    },
  });

  if (!refItem) {
    return NextResponse.json({ rows: [], standardRate: null, displayName: ageroRef, tradeSectionCode: '' });
  }

  return NextResponse.json({
    rows: refItem.buildUps.map((b) => ({
      id: b.id,
      buildUpType: b.buildUpType,
      description: b.description,
      unit: b.unit,
      quantityPerBaseUnit: Number(b.quantityPerBaseUnit),
      unitRate: Number(b.unitRate),
      calculatedCost: Number(b.calculatedCost),
      sortOrder: b.sortOrder,
    })),
    standardRate: refItem.rates[0] ? Number(refItem.rates[0].unitCost) : null,
    displayName: refItem.displayName,
    tradeSectionCode: refItem.tradeSectionCode,
  });
}
