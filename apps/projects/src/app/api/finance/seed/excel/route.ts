import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

const MARCH_2026 = new Date('2026-03-01');
const FY_2026 = 2026;

const MONTHS_FY = ['jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun'] as const;

function toN(v: unknown): number {
  if (v === undefined || v === null || v === '') return 0;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function mapProjectStatus(v: string): 'AWARDED' | 'BACKLOG' | 'DLP' | 'CLOSED' {
  const s = String(v ?? '').toUpperCase();
  if (s.includes('BACKLOG')) return 'BACKLOG';
  if (s.includes('DLP')) return 'DLP';
  if (s.includes('CLOSED') || s.includes('COMPLETE')) return 'CLOSED';
  return 'AWARDED';
}

function mapBudgetCategory(v: string): string {
  const s = String(v ?? '').toUpperCase();
  if (s.includes('REVENUE') || s.includes('INCOME')) return 'REVENUE';
  if (s.includes('COST OF SALES') || s.includes('COS')) return 'COST_OF_SALES';
  if (s.includes('DIRECT LABOUR') || s.includes('DIRECT LAB')) return 'DIRECT_LABOUR';
  if (s.includes('INDIRECT LABOUR') || s.includes('INDIRECT LAB')) return 'INDIRECT_LABOUR';
  if (s.includes('INDIRECT') || s.includes('OVERHEAD')) return 'INDIRECT_EXPENSES';
  if (s.includes('MARKET')) return 'MARKETING';
  return 'INDIRECT_EXPENSES';
}

export async function POST(req: NextRequest) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

  const orgId = user.organisationId;
  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: 'buffer' });

  const results: Record<string, unknown> = {};

  // ── Sheet: Business P&L → XeroPnL ────────────────────────────────────────
  const pnlSheetName = wb.SheetNames.find((n) =>
    n.toLowerCase().includes('p&l') || n.toLowerCase().includes('profit')
  );
  if (pnlSheetName) {
    const ws = wb.Sheets[pnlSheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[];
    const getValue = (label: string) => {
      const row = rows.find((r) =>
        Object.values(r).some((v) => String(v).toLowerCase().includes(label.toLowerCase()))
      );
      if (!row) return 0;
      const keys = Object.keys(row);
      const valKey = keys.find((k) => k !== keys[0] && toN(row[k]) !== 0);
      return valKey ? toN(row[valKey]) : 0;
    };

    const revenue = getValue('total income') || getValue('revenue');
    const cos = getValue('cost of sales') || getValue('total cos');
    const dl = getValue('direct labour');
    const gp = getValue('gross profit') || (revenue - cos - dl);
    const ie = getValue('overhead') || getValue('indirect expenses');
    const il = getValue('indirect labour');
    const mk = getValue('marketing');
    const np = getValue('net profit') || (gp - ie - il - mk);

    await prisma.xeroPnL.upsert({
      where: { organisationId_reportMonth: { organisationId: orgId, reportMonth: MARCH_2026 } },
      update: { revenue: revenue.toFixed(2), costOfSales: cos.toFixed(2), directLabour: dl.toFixed(2), grossProfit: gp.toFixed(2), indirectExpenses: ie.toFixed(2), indirectLabour: il.toFixed(2), marketingExpenses: mk.toFixed(2), netProfitBeforeTax: np.toFixed(2) },
      create: { organisationId: orgId, reportMonth: MARCH_2026, revenue: revenue.toFixed(2), costOfSales: cos.toFixed(2), directLabour: dl.toFixed(2), grossProfit: gp.toFixed(2), indirectExpenses: ie.toFixed(2), indirectLabour: il.toFixed(2), marketingExpenses: mk.toFixed(2), netProfitBeforeTax: np.toFixed(2) },
    });
    results.pnl = 'seeded';
  }

  // ── Sheet: CAT Financial / Finance → FinanceProject ──────────────────────
  const catSheetName = wb.SheetNames.find((n) =>
    n.toLowerCase().includes('cat') || n.toLowerCase().includes('job') || n.toLowerCase().includes('finance proj')
  );
  if (catSheetName) {
    const ws = wb.Sheets[catSheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[];
    let count = 0;
    for (const row of rows) {
      const jobNumber = String(row['Job No'] ?? row['Job Number'] ?? row['Job'] ?? '').trim();
      if (!jobNumber || jobNumber.toLowerCase() === 'total') continue;

      const projectName = String(row['Project Name'] ?? row['Project'] ?? row['Description'] ?? jobNumber);
      const status = mapProjectStatus(String(row['Status'] ?? ''));
      const cv = toN(row['Contract Value'] ?? row['Contract'] ?? row['Forecast Contract Value']);
      const fc = toN(row['Forecast Final Costs'] ?? row['Final Cost'] ?? row['Forecast Cost']);
      const ro = toN(row['R&O'] ?? row['Risk'] ?? 0);
      const ct = toN(row['Claim Total'] ?? row['Claims'] ?? row['Revenue To Date'] ?? 0);
      const cr = toN(row['Retention'] ?? row['Claim Retention'] ?? 0);
      const sc = toN(row['Sub Claims'] ?? row['Subcontractor'] ?? 0);
      const sr = toN(row['Sub Retention'] ?? 0);
      const cred = toN(row['Creditors'] ?? 0);
      const lab = toN(row['Labour'] ?? row['Direct Labour'] ?? 0);
      const marginDollars = cv - fc + ro;
      const marginPct = cv !== 0 ? marginDollars / cv : 0;
      const totalCost = sc + cred + lab;
      const wip = ct - totalCost;

      await prisma.financeProject.upsert({
        where: { id: `placeholder-${jobNumber}` },
        update: {
          projectName, status, forecastContractValue: cv.toFixed(2), forecastFinalCosts: fc.toFixed(2),
          riskAndOpportunity: ro.toFixed(2), forecastMarginDollars: marginDollars.toFixed(2),
          forecastMarginPercent: marginPct.toFixed(6), claimTotal: ct.toFixed(2),
          claimRetention: cr.toFixed(2), subClaims: sc.toFixed(2), subRetention: sr.toFixed(2),
          creditors: cred.toFixed(2), labour: lab.toFixed(2), totalCost: totalCost.toFixed(2), wip: wip.toFixed(2),
        },
        create: {
          id: `placeholder-${jobNumber}`,
          organisationId: orgId,
          reportMonth: MARCH_2026,
          jobNumber, projectName, status,
          forecastContractValue: cv.toFixed(2), forecastFinalCosts: fc.toFixed(2),
          riskAndOpportunity: ro.toFixed(2), forecastMarginDollars: marginDollars.toFixed(2),
          forecastMarginPercent: marginPct.toFixed(6), claimTotal: ct.toFixed(2),
          claimRetention: cr.toFixed(2), subClaims: sc.toFixed(2), subRetention: sr.toFixed(2),
          creditors: cred.toFixed(2), labour: lab.toFixed(2), totalCost: totalCost.toFixed(2), wip: wip.toFixed(2),
        },
      });
      count++;
    }
    results.projects = `${count} seeded`;
  }

  // ── Sheet: Budget → AnnualBudget ─────────────────────────────────────────
  const budgetSheetName = wb.SheetNames.find((n) =>
    n.toLowerCase().includes('budget')
  );
  if (budgetSheetName) {
    const ws = wb.Sheets[budgetSheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[];
    let order = 0;
    for (const row of rows) {
      const lineItem = String(row['Line Item'] ?? row['Description'] ?? row['Account'] ?? '').trim();
      if (!lineItem || lineItem.toLowerCase() === 'total') continue;
      const category = mapBudgetCategory(String(row['Category'] ?? row['Group'] ?? lineItem));

      const monthData: Record<string, string> = {};
      for (const m of MONTHS_FY) {
        const v = toN(row[m.charAt(0).toUpperCase() + m.slice(1)] ?? row[m] ?? 0);
        monthData[m] = v.toFixed(2);
      }
      const total = MONTHS_FY.reduce((s, m) => s + parseFloat(monthData[m]), 0);

      await prisma.annualBudget.upsert({
        where: { id: `budget-${FY_2026}-${category}-${lineItem}` },
        update: { ...monthData, total: total.toFixed(2) },
        create: {
          id: `budget-${FY_2026}-${category}-${lineItem}`,
          organisationId: orgId,
          financialYear: FY_2026,
          category,
          lineItem,
          displayOrder: order++,
          ...monthData,
          total: total.toFixed(2),
        },
      });
    }
    results.budget = 'seeded';
  }

  // ── Sheet: Cash Flow → XeroBankBalance ───────────────────────────────────
  const cashSheetName = wb.SheetNames.find((n) =>
    n.toLowerCase().includes('cash') || n.toLowerCase().includes('bank')
  );
  if (cashSheetName) {
    const ws = wb.Sheets[cashSheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[];
    for (const row of rows) {
      const accountName = String(row['Account'] ?? row['Bank Account'] ?? row['Name'] ?? '').trim();
      if (!accountName) continue;
      const balance = toN(row['March'] ?? row['Mar'] ?? row['Balance'] ?? row['Closing Balance'] ?? 0);
      await prisma.xeroBankBalance.upsert({
        where: { organisationId_reportMonth_accountName: { organisationId: orgId, reportMonth: MARCH_2026, accountName } },
        update: { balance: balance.toFixed(2) },
        create: { organisationId: orgId, reportMonth: MARCH_2026, accountName, balance: balance.toFixed(2) },
      });
    }
    results.bankBalances = 'seeded';
  }

  // ── Seed MonthEndStatus ───────────────────────────────────────────────────
  await prisma.monthEndStatus.upsert({
    where: { organisationId_reportMonth: { organisationId: orgId, reportMonth: MARCH_2026 } },
    update: { status: 'SYNCED', notes: 'Seeded from March 2026 Excel — awaiting live Xero connection.', xeroSyncedAt: new Date() },
    create: { organisationId: orgId, reportMonth: MARCH_2026, status: 'SYNCED', notes: 'Seeded from March 2026 Excel — awaiting live Xero connection.', xeroSyncedAt: new Date() },
  });

  return NextResponse.json({ ok: true, results, sheets: wb.SheetNames });
}
