import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { reportMonth } = await req.json() as { reportMonth: string };
  const reportDate = new Date(reportMonth + '-01');

  await prisma.monthEndStatus.upsert({
    where: { organisationId_reportMonth: { organisationId: user.organisationId, reportMonth: reportDate } },
    update: { dataVerifiedAt: new Date() },
    create: { organisationId: user.organisationId, reportMonth: reportDate, status: 'SYNCED', dataVerifiedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
