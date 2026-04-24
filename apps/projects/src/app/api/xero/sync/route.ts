import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getRefreshedXeroClient } from '@/lib/xero/client';
import Decimal from 'decimal.js';

function firstDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function lastDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}
function fmt(d: Date) {
  return d.toISOString().split('T')[0];
}

type ReportRow = { rowType?: string; title?: string; cells?: { value?: string }[] };

function extractReportValue(rows: ReportRow[], label: string): Decimal {
  for (const row of rows) {
    if ((row.title ?? '').toLowerCase().includes(label.toLowerCase())) {
      const val = row.cells?.[1]?.value ?? row.cells?.[0]?.value ?? '0';
      return new Decimal(val.replace(/[^0-9.-]/g, '') || '0');
    }
    if (row.rowType === 'Section' && Array.isArray((row as unknown as { rows?: ReportRow[] }).rows)) {
      const found = extractReportValue((row as unknown as { rows: ReportRow[] }).rows, label);
      if (!found.isZero()) return found;
    }
  }
  return new Decimal(0);
}

export async function POST(req: NextRequest) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await req.json();
  const { report_month } = body as { report_month: string };
  if (!report_month) {
    return NextResponse.json({ error: 'report_month is required (YYYY-MM-DD)' }, { status: 400 });
  }

  const reportDate = new Date(report_month);
  const monthKey = firstDay(reportDate);

  // Check gate
  const gate = await prisma.monthEndStatus.findUnique({
    where: { organisationId_reportMonth: { organisationId: user.organisationId, reportMonth: monthKey } },
  });
  if (!gate || gate.status !== 'READY') {
    return NextResponse.json(
      { error: 'Month must be marked as READY before syncing Xero.' },
      { status: 400 }
    );
  }

  const xero = await getRefreshedXeroClient(user.organisationId);
  if (!xero) {
    return NextResponse.json({ error: 'Xero is not connected.' }, { status: 400 });
  }

  const conn = await prisma.xeroConnection.findUnique({ where: { organisationId: user.organisationId } });
  const tenantId = conn?.xeroTenantId ?? xero.tenants[0]?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'No Xero tenant found.' }, { status: 400 });
  }

  const fromDate = fmt(firstDay(reportDate));
  const toDate = fmt(lastDay(reportDate));

  // Fetch P&L
  const pnlResp = await xero.accountingApi.getReportProfitAndLoss(tenantId, fromDate, toDate);
  const pnlRows: ReportRow[] = (pnlResp.body.reports?.[0]?.rows ?? []) as unknown as ReportRow[];

  const revenue = extractReportValue(pnlRows, 'total income');
  const costOfSales = extractReportValue(pnlRows, 'total cost of sales');
  const directLabour = extractReportValue(pnlRows, 'direct labour');
  const grossProfit = extractReportValue(pnlRows, 'gross profit');
  const indirectExpenses = extractReportValue(pnlRows, 'total overhead');
  const indirectLabour = extractReportValue(pnlRows, 'indirect labour');
  const marketingExpenses = extractReportValue(pnlRows, 'marketing');
  const netProfit = extractReportValue(pnlRows, 'net profit');

  // Fetch Balance Sheet
  const bsResp = await xero.accountingApi.getReportBalanceSheet(tenantId, toDate);
  const bsRows: ReportRow[] = (bsResp.body.reports?.[0]?.rows ?? []) as unknown as ReportRow[];

  const tradeDebtors = extractReportValue(bsRows, 'trade debtors');
  const tradeCreditors = extractReportValue(bsRows, 'trade creditors');

  // Calculate debtor/creditor days
  const debtorDays = revenue.gt(0) ? tradeDebtors.div(revenue).mul(30) : new Decimal(0);
  const creditorDays = costOfSales.gt(0) ? tradeCreditors.div(costOfSales).mul(30) : new Decimal(0);

  // Upsert P&L
  await prisma.xeroPnL.upsert({
    where: { organisationId_reportMonth: { organisationId: user.organisationId, reportMonth: monthKey } },
    update: {
      revenue: revenue.toFixed(2),
      costOfSales: costOfSales.toFixed(2),
      directLabour: directLabour.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      indirectExpenses: indirectExpenses.toFixed(2),
      indirectLabour: indirectLabour.toFixed(2),
      marketingExpenses: marketingExpenses.toFixed(2),
      netProfitBeforeTax: netProfit.toFixed(2),
      debtorDays: debtorDays.toFixed(2),
      creditorDays: creditorDays.toFixed(2),
      tradeDebtors: tradeDebtors.toFixed(2),
      tradeCreditors: tradeCreditors.toFixed(2),
    },
    create: {
      organisationId: user.organisationId,
      reportMonth: monthKey,
      revenue: revenue.toFixed(2),
      costOfSales: costOfSales.toFixed(2),
      directLabour: directLabour.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      indirectExpenses: indirectExpenses.toFixed(2),
      indirectLabour: indirectLabour.toFixed(2),
      marketingExpenses: marketingExpenses.toFixed(2),
      netProfitBeforeTax: netProfit.toFixed(2),
      debtorDays: debtorDays.toFixed(2),
      creditorDays: creditorDays.toFixed(2),
      tradeDebtors: tradeDebtors.toFixed(2),
      tradeCreditors: tradeCreditors.toFixed(2),
    },
  });

  // Extract bank balances from Balance Sheet
  const bankRows = bsRows.filter((r) => {
    const title = (r.title ?? '').toLowerCase();
    return title.includes('bank') || title.includes('cash');
  });

  let bankCount = 0;
  for (const row of bankRows) {
    const accountName = row.title ?? 'Unknown';
    const balance = new Decimal(row.cells?.[0]?.value?.replace(/[^0-9.-]/g, '') ?? '0');
    await prisma.xeroBankBalance.upsert({
      where: {
        organisationId_reportMonth_accountName: {
          organisationId: user.organisationId,
          reportMonth: monthKey,
          accountName,
        },
      },
      update: { balance: balance.toFixed(2) },
      create: {
        organisationId: user.organisationId,
        reportMonth: monthKey,
        accountName,
        balance: balance.toFixed(2),
      },
    });
    bankCount++;
  }

  // Update MonthEndStatus to SYNCED
  await prisma.monthEndStatus.update({
    where: { organisationId_reportMonth: { organisationId: user.organisationId, reportMonth: monthKey } },
    data: { status: 'SYNCED', xeroSyncedAt: new Date() },
  });

  return NextResponse.json({
    ok: true,
    summary: {
      revenue: revenue.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      netProfit: netProfit.toFixed(2),
      debtorDays: debtorDays.toFixed(1),
      creditorDays: creditorDays.toFixed(1),
      bankAccountsUpdated: bankCount,
    },
  });
}
