import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const user = await requireAppUser();
  const fy = Number(req.nextUrl.searchParams.get('fy') ?? 2026);

  const rows = await prisma.unsecuredOpportunity.findMany({
    where: { organisationId: user.organisationId, financialYear: fy, deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json();
  const row = await prisma.unsecuredOpportunity.create({
    data: {
      organisationId: user.organisationId,
      financialYear: body.financialYear ?? 2026,
      status: body.status ?? 'UNSECURED',
      projectName: body.projectName ?? 'New Opportunity',
      contractValue: body.contractValue != null ? String(body.contractValue) : null,
      forecastMarginPct: body.forecastMarginPct != null ? String(body.forecastMarginPct) : null,
      jul: String(body.jul ?? 0),
      aug: String(body.aug ?? 0),
      sep: String(body.sep ?? 0),
      oct: String(body.oct ?? 0),
      nov: String(body.nov ?? 0),
      dec: String(body.dec ?? 0),
      jan: String(body.jan ?? 0),
      feb: String(body.feb ?? 0),
      mar: String(body.mar ?? 0),
      apr: String(body.apr ?? 0),
      may: String(body.may ?? 0),
      jun: String(body.jun ?? 0),
      nextYear: String(body.nextYear ?? 0),
      sortOrder: body.sortOrder ?? 0,
      notes: body.notes ?? null,
    },
  });

  return NextResponse.json(row, { status: 201 });
}
