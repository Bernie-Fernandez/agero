import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.unsecuredOpportunity.findFirst({
    where: { id, organisationId: user.organisationId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updateData: Record<string, unknown> = {};
  const fields = ['status', 'projectName', 'sortOrder', 'notes'] as const;
  for (const f of fields) {
    if (body[f] !== undefined) updateData[f] = body[f];
  }
  const decimalFields = [
    'contractValue', 'forecastMarginPct',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
    'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'nextYear',
  ] as const;
  for (const f of decimalFields) {
    if (body[f] !== undefined) updateData[f] = body[f] != null ? String(body[f]) : null;
  }

  const updated = await prisma.unsecuredOpportunity.update({ where: { id }, data: updateData });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.unsecuredOpportunity.findFirst({
    where: { id, organisationId: user.organisationId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.unsecuredOpportunity.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
