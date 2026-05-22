import { NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await requireAppUser();
  const conflicts = await prisma.lead.findMany({
    where: { organisationId: user.organisationId, syncStatus: 'CONFLICT', deletedAt: null },
    include: {
      ownerUser: { select: { id: true, firstName: true, lastName: true } },
      syncLogs: {
        where: { status: 'CONFLICT' },
        orderBy: { syncedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json(JSON.parse(JSON.stringify(conflicts)));
}
