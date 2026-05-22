import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type BulkRow = {
  id?: string;
  financialYear: number;
  status?: string;
  projectName: string;
  contractValue?: number | null;
  forecastMarginPct?: number | null;
  jul?: number; aug?: number; sep?: number; oct?: number; nov?: number; dec?: number;
  jan?: number; feb?: number; mar?: number; apr?: number; may?: number; jun?: number;
  nextYear?: number;
  sortOrder?: number;
  notes?: string | null;
  _delete?: boolean;
};

function toStr(v: number | null | undefined): string {
  return v != null ? String(v) : '0';
}

export async function POST(req: NextRequest) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const rows: BulkRow[] = await req.json();
  const orgId = user.organisationId;

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      if (row._delete && row.id) {
        await tx.unsecuredOpportunity.update({
          where: { id: row.id },
          data: { deletedAt: new Date() },
        });
        continue;
      }

      const data = {
        status: (row.status as 'UNSECURED' | 'RESEARCH' | 'VALIDATED' | 'QUALIFIED') ?? 'UNSECURED',
        projectName: row.projectName,
        contractValue: row.contractValue != null ? String(row.contractValue) : null,
        forecastMarginPct: row.forecastMarginPct != null ? String(row.forecastMarginPct) : null,
        jul: toStr(row.jul), aug: toStr(row.aug), sep: toStr(row.sep), oct: toStr(row.oct),
        nov: toStr(row.nov), dec: toStr(row.dec), jan: toStr(row.jan), feb: toStr(row.feb),
        mar: toStr(row.mar), apr: toStr(row.apr), may: toStr(row.may), jun: toStr(row.jun),
        nextYear: toStr(row.nextYear),
        sortOrder: row.sortOrder ?? 0,
        notes: row.notes ?? null,
      };

      if (row.id) {
        const existing = await tx.unsecuredOpportunity.findFirst({
          where: { id: row.id, organisationId: orgId, deletedAt: null },
        });
        if (existing) {
          await tx.unsecuredOpportunity.update({ where: { id: row.id }, data });
        }
      } else {
        await tx.unsecuredOpportunity.create({
          data: { organisationId: orgId, financialYear: row.financialYear, ...data },
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
