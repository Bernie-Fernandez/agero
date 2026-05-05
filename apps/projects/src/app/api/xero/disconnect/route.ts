import { NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST() {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  await prisma.xeroConnection.updateMany({
    where: { organisationId: user.organisationId },
    data: { status: 'DISCONNECTED' },
  });

  return NextResponse.json({ ok: true });
}
