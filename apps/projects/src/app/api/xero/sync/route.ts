import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getRefreshedXeroClient } from '@/lib/xero/client';
import { decryptToken } from '@/lib/xero/crypto';
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

type ReportRow = {
  rowType?: string;
  title?: string;
  cells?: { value?: string }[];
  rows?: ReportRow[];
};

type AgedRow = { RowType?: string; Cells?: { Value?: string }[] };
type AgedReport = { RowType?: string; Rows?: AgedRow[]; Cells?: { Value?: string }[] };
type AgedResponse = { Reports?: { Rows?: AgedReport[] }[] };

function extractReportValue(rows: ReportRow[], label: string): Decimal {
  for (const row of rows) {
    if ((row.title ?? '').toLowerCase().includes(label.toLowerCase())) {
      const val = row.cells?.[1]?.value ?? row.cells?.[0]?.value ?? '0';
      return new Decimal(val.replace(/[^0-9.-]/g, '') || '0');
    }
    if (row.rowType === 'Section' && Array.isArray(row.rows)) {
      const found = extractReportValue(row.rows, label);
      if (!found.isZero()) return found;
    }
  }
  return new Decimal(0);
}

// Extract grand total Amount Due from an AgedReceivables/AgedPayables JSON response.
// Xero places the total in the SummaryRow; cells[2] is "Amount Due".
function extractAgedTotal(data: AgedResponse | null): Decimal {
  if (!data) return new Decimal(0);
  const rows = data.Reports?.[0]?.Rows ?? [];
  for (const row of rows) {
    if (row.RowType === 'SummaryRow') {
      const val = row.Cells?.[2]?.Value ?? '0';
      return new Decimal(val.replace(/[^0-9.-]/g, '') || '0');
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

  // Re-read the connection after getRefreshedXeroClient (it may have refreshed the token)
  const freshConn = await prisma.xeroConnection.findUnique({ where: { organisationId: user.organisationId } });
  const accessToken = decryptToken(freshConn!.accessToken);

  const fromDate = fmt(firstDay(reportDate));
  const toDate = fmt(lastDay(reportDate));

  // ── 1. Profit & Loss ─────────────────────────────────────────────────────────
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

  // ── 2. Balance Sheet ──────────────────────────────────────────────────────────
  const bsResp = await xero.accountingApi.getReportBalanceSheet(tenantId, toDate);
  const bsRows: ReportRow[] = (bsResp.body.reports?.[0]?.rows ?? []) as unknown as ReportRow[];

  // ── 3. Bank Summary ───────────────────────────────────────────────────────────
  const bankSummaryResp = await xero.accountingApi.getReportBankSummary(tenantId, fromDate, toDate);
  const bankSummaryRows: ReportRow[] = (bankSummaryResp.body.reports?.[0]?.rows ?? []) as unknown as ReportRow[];

  // ── 4. Aged Receivables & Payables (direct fetch — SDK requires contactId but REST API does not) ──
  const agedHeaders = {
    Authorization: `Bearer ${accessToken}`,
    'xero-tenant-id': tenantId,
    Accept: 'application/json',
  };

  const [agedRecRes, agedPayRes] = await Promise.all([
    fetch(`https://api.xero.com/api.xro/2.0/Reports/AgedReceivablesByContact?fromDate=${fromDate}&toDate=${toDate}`, { headers: agedHeaders }),
    fetch(`https://api.xero.com/api.xro/2.0/Reports/AgedPayablesByContact?fromDate=${fromDate}&toDate=${toDate}`, { headers: agedHeaders }),
  ]);

  const agedRecData: AgedResponse | null = agedRecRes.ok ? (await agedRecRes.json() as AgedResponse) : null;
  const agedPayData: AgedResponse | null = agedPayRes.ok ? (await agedPayRes.json() as AgedResponse) : null;

  const tradeDebtors = extractAgedTotal(agedRecData);
  const tradeCreditors = extractAgedTotal(agedPayData);

  // Fallback to balance sheet values if aged reports returned nothing
  const effectiveDebtors = tradeDebtors.isZero()
    ? extractReportValue(bsRows, 'trade debtors')
    : tradeDebtors;
  const effectiveCreditors = tradeCreditors.isZero()
    ? extractReportValue(bsRows, 'trade creditors')
    : tradeCreditors;

  const debtorDays = revenue.gt(0) ? effectiveDebtors.div(revenue).mul(30) : new Decimal(0);
  const creditorDays = costOfSales.gt(0) ? effectiveCreditors.div(costOfSales).mul(30) : new Decimal(0);

  // ── Upsert P&L ────────────────────────────────────────────────────────────────
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
      tradeDebtors: effectiveDebtors.toFixed(2),
      tradeCreditors: effectiveCreditors.toFixed(2),
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
      tradeDebtors: effectiveDebtors.toFixed(2),
      tradeCreditors: effectiveCreditors.toFixed(2),
    },
  });

  // ── Seed bank balances from BankSummary report ────────────────────────────────
  // BankSummary rows: Header row, then data rows with cells[0]=account, cells[4]=closing balance
  let bankCount = 0;
  for (const row of bankSummaryRows) {
    const rowType = (row.rowType ?? '').toLowerCase();
    if (rowType === 'row') {
      const accountName = (row.cells?.[0]?.value ?? '').trim();
      if (!accountName || accountName.toLowerCase() === 'total') continue;
      const balance = new Decimal(row.cells?.[4]?.value?.replace(/[^0-9.-]/g, '') ?? '0');
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
    // BankSummary may nest rows inside Sections
    if (rowType === 'section' && Array.isArray(row.rows)) {
      for (const inner of row.rows) {
        const innerType = (inner.rowType ?? '').toLowerCase();
        if (innerType !== 'row') continue;
        const accountName = (inner.cells?.[0]?.value ?? '').trim();
        if (!accountName || accountName.toLowerCase() === 'total') continue;
        const balance = new Decimal(inner.cells?.[4]?.value?.replace(/[^0-9.-]/g, '') ?? '0');
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
    }
  }

  // ── Update MonthEndStatus to SYNCED ───────────────────────────────────────────
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
      tradeDebtors: effectiveDebtors.toFixed(2),
      tradeCreditors: effectiveCreditors.toFixed(2),
      debtorDays: debtorDays.toFixed(1),
      creditorDays: creditorDays.toFixed(1),
      bankAccountsUpdated: bankCount,
      agedReceivablesOk: agedRecRes.ok,
      agedPayablesOk: agedPayRes.ok,
    },
  });
}
