import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const MONTHS = ['jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun'] as const;

export async function POST(req: NextRequest) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { rows } = await req.json() as { rows: Array<{ id: string; [key: string]: string | number }>; financialYear: number };

  for (const row of rows) {
    const monthData: Record<string, string> = {};
    for (const m of MONTHS) {
      const v = parseFloat(String(row[m] ?? '0'));
      monthData[m] = isNaN(v) ? '0' : v.toFixed(2);
    }
    const total = MONTHS.reduce((s, m) => s + parseFloat(monthData[m]), 0);

    await prisma.annualBudget.update({
      where: { id: row.id },
      data: { ...monthData, total: total.toFixed(2) },
    });
  }

  return NextResponse.json({ ok: true });
}
