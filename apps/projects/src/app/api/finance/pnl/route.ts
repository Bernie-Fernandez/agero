import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await req.json();
  const { reportMonth, ...fields } = body as {
    reportMonth: string;
    awardedGrossProfitYtd?: string;
    awardedRevenueYtd?: string;
    backlogGrossProfitYtd?: string;
    backlogRevenueYtd?: string;
    netProjectCashFlow?: string;
    awardedYtdBudgetMargin?: string;
    backlogYtdBudgetMargin?: string;
  };

  if (!reportMonth) return NextResponse.json({ error: 'reportMonth required' }, { status: 400 });

  const month = new Date(reportMonth);

  const updated = await prisma.xeroPnL.upsert({
    where: { organisationId_reportMonth: { organisationId: user.organisationId, reportMonth: month } },
    update: fields,
    create: { organisationId: user.organisationId, reportMonth: month, ...fields },
  });

  return NextResponse.json(JSON.parse(JSON.stringify(updated)));
}
