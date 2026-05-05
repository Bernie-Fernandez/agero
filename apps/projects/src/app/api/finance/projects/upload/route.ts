import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

function toNum(v: unknown): string {
  if (v === undefined || v === null || v === '') return '0';
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? '0' : n.toFixed(2);
}

function mapStatus(v: string): 'AWARDED' | 'BACKLOG' | 'DLP' | 'CLOSED' {
  const s = String(v ?? '').toUpperCase();
  if (s.includes('BACKLOG')) return 'BACKLOG';
  if (s.includes('DLP')) return 'DLP';
  if (s.includes('CLOSED') || s.includes('COMPLETE')) return 'CLOSED';
  return 'AWARDED';
}

export async function POST(req: NextRequest) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const reportMonthStr = formData.get('reportMonth') as string | null;
  if (!file || !reportMonthStr) {
    return NextResponse.json({ error: 'Missing file or reportMonth' }, { status: 400 });
  }

  const reportMonth = new Date(reportMonthStr);
  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[];

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const jobNumber = String(row['Job No'] ?? row['Job Number'] ?? row['JobNo'] ?? '').trim();
      if (!jobNumber) { errors++; continue; }

      const projectName = String(row['Project Name'] ?? row['ProjectName'] ?? row['Description'] ?? jobNumber);
      const status = mapStatus(String(row['Status'] ?? ''));
      const forecastContractValue = toNum(row['Contract Value'] ?? row['Contract'] ?? row['Forecast Contract Value']);
      const forecastFinalCosts = toNum(row['Forecast Final Costs'] ?? row['Final Cost']);
      const riskAndOpportunity = toNum(row['R&O'] ?? row['Risk'] ?? 0);
      const claimTotal = toNum(row['Claim Total'] ?? row['Claims'] ?? row['Revenue To Date']);
      const claimRetention = toNum(row['Retention'] ?? row['Claim Retention'] ?? 0);
      const subClaims = toNum(row['Sub Claims'] ?? row['Subcontractor Claims'] ?? 0);
      const subRetention = toNum(row['Sub Retention'] ?? 0);
      const creditors = toNum(row['Creditors'] ?? 0);
      const labour = toNum(row['Labour'] ?? row['Direct Labour'] ?? 0);

      const cv = parseFloat(forecastContractValue);
      const fc = parseFloat(forecastFinalCosts);
      const ro = parseFloat(riskAndOpportunity);
      const marginDollars = cv - fc + ro;
      const marginPct = cv !== 0 ? marginDollars / cv : 0;
      const sc = parseFloat(subClaims);
      const cr = parseFloat(creditors);
      const lab = parseFloat(labour);
      const totalCost = sc + cr + lab;
      const ct = parseFloat(claimTotal);
      const wip = ct - totalCost;

      const existing = await prisma.financeProject.findFirst({
        where: { organisationId: user.organisationId, reportMonth, jobNumber, deletedAt: null },
      });

      const data = {
        projectName, status, forecastContractValue, forecastFinalCosts,
        riskAndOpportunity, forecastMarginDollars: marginDollars.toFixed(2),
        forecastMarginPercent: marginPct.toFixed(6), claimTotal, claimRetention,
        subClaims, subRetention, creditors, labour,
        totalCost: totalCost.toFixed(2), wip: wip.toFixed(2),
      };

      if (existing) {
        await prisma.financeProject.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await prisma.financeProject.create({
          data: { organisationId: user.organisationId, reportMonth, jobNumber, ...data },
        });
        created++;
      }
    } catch {
      errors++;
    }
  }

  return NextResponse.json({ created, updated, errors });
}
