import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await req.json() as { id: string };

  const record = await prisma.monthEndStatus.findFirst({
    where: { id, organisationId: user.organisationId },
  });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (record.status !== 'OPEN') return NextResponse.json({ error: 'Month is not OPEN' }, { status: 400 });

  await prisma.monthEndStatus.update({
    where: { id },
    data: { status: 'READY', markedReadyById: user.id, markedReadyAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
