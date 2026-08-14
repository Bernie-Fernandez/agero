import Decimal from 'decimal.js';
import { prisma } from '@/lib/prisma';
import { getRefreshedXeroClient } from '@/lib/xero/client';
import { decryptToken } from '@/lib/xero/crypto';
import {
  findReportValue,
  findReportValueOrZero,
  listAccountLines,
  parseAmount,
  sumAccountLines,
  type MatchedAccountLine,
  type XeroReportRow,
} from '@/lib/xero/report-rows';

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function firstDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
export function lastDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}
function fmt(d: Date) {
  return d.toISOString().split('T')[0];
}

type ReportRow = XeroReportRow;

type AgedRow = { RowType?: string; Cells?: { Value?: string }[]; Rows?: AgedRow[] };
type AgedReport = { RowType?: string; Rows?: AgedRow[]; Cells?: { Value?: string }[] };
type AgedResponse = { Reports?: { Rows?: AgedReport[] }[] };

// Extract grand total Amount Due from an AgedReceivables/AgedPayables JSON response.
// This is the raw REST shape (PascalCase), not the SDK shape. Xero places the
// total in a SummaryRow; cells[2] is "Amount Due".
function extractAgedTotal(data: AgedResponse | null): Decimal {
  if (!data) return new Decimal(0);
  const walk = (rows: AgedRow[]): Decimal | null => {
    for (const row of rows) {
      if (row.RowType === 'SummaryRow') return parseAmount(row.Cells?.[2]?.Value);
      if (row.Rows?.length) {
        const found = walk(row.Rows);
        if (found) return found;
      }
    }
    return null;
  };
  return walk((data.Reports?.[0]?.Rows ?? []) as AgedRow[]) ?? new Decimal(0);
}

type AccountGroup = {
  total: Decimal;
  matched: MatchedAccountLine[];
  /** How the figure was arrived at — recorded so a 0.00 is never ambiguous. */
  source: 'account-lines' | 'group-total' | 'not-found';
};

/**
 * Resolve a reporting concept that may be expressed either as a set of account
 * lines or as a single sub-section total, depending on how the chart of
 * accounts is arranged.
 *
 * Account lines win when present. When none match, the section total is used —
 * that covers a concept nested as its own sub-section, where the only row
 * carrying the name is the "Total X" SummaryRow. `not-found` means the labels
 * matched nothing at all, which is a chart-of-accounts change, not a real zero.
 */
function resolveAccountGroup(
  rows: ReportRow[],
  spec: { lines: string[]; groupTotals: string[]; exclude?: string[] },
): AccountGroup {
  const summed = sumAccountLines(rows, spec.lines, { exclude: spec.exclude });
  if (summed.matched.length > 0) {
    return { total: summed.total, matched: summed.matched, source: 'account-lines' };
  }

  const groupTotal = findReportValue(rows, ...spec.groupTotals, ...spec.lines);
  if (groupTotal !== null) {
    return { total: groupTotal, matched: [], source: 'group-total' };
  }

  return { total: new Decimal(0), matched: [], source: 'not-found' };
}

export type XeroMonthSyncSummary = {
  revenue: string;
  costOfSales: string;
  grossProfit: string;
  netProfit: string;
  grossProfitDerived: boolean;
  netProfitDerived: boolean;
  directLabour: string;
  indirectLabour: string;
  marketingExpenses: string;
  directLabourAccounts: MatchedAccountLine[];
  indirectLabourAccounts: MatchedAccountLine[];
  marketingAccounts: MatchedAccountLine[];
  /** Where each derived figure came from — 'not-found' means no label matched. */
  resolution: Record<'directLabour' | 'indirectLabour' | 'marketing', AccountGroup['source']>;
  /** Every account line the P&L contained, so labels can be checked after the fact. */
  accountLines: MatchedAccountLine[];
  tradeDebtors: string;
  tradeCreditors: string;
  debtorDays: string;
  creditorDays: string;
  bankAccountsUpdated: number;
  agedReceivablesOk: boolean;
  agedPayablesOk: boolean;
};

export type XeroMonthSyncResult =
  | { ok: true; summary: XeroMonthSyncSummary }
  | { ok: false; status: number; error: string };

/**
 * Pull the P&L, balance sheet, bank summary and aged AR/AP for one month from
 * Xero and persist them to XeroPnL / XeroBankBalance.
 *
 * `reportMonth` must be the first of the month at UTC midnight. Callers are
 * responsible for authorisation and for the MonthEndStatus workflow gate.
 */
export async function syncXeroMonth(
  organisationId: string,
  reportMonth: Date,
): Promise<XeroMonthSyncResult> {
  const monthKey = firstDay(reportMonth);

  const xero = await getRefreshedXeroClient(organisationId);
  if (!xero) {
    return { ok: false, status: 400, error: 'Xero is not connected.' };
  }

  const conn = await prisma.xeroConnection.findUnique({ where: { organisationId } });
  const tenantId = conn?.xeroTenantId ?? xero.tenants[0]?.tenantId;
  if (!tenantId) {
    return { ok: false, status: 400, error: 'No Xero tenant found.' };
  }

  // Re-read the connection after getRefreshedXeroClient (it may have refreshed the token)
  const freshConn = await prisma.xeroConnection.findUnique({ where: { organisationId } });
  const accessToken = decryptToken(freshConn!.accessToken);

  const fromDate = fmt(monthKey);
  const toDate = fmt(lastDay(monthKey));

  // ── 1. Profit & Loss ─────────────────────────────────────────────────────────
  const pnlResp = await xero.accountingApi.getReportProfitAndLoss(tenantId, fromDate, toDate);
  const pnlRows: ReportRow[] = (pnlResp.body.reports?.[0]?.rows ?? []) as unknown as ReportRow[];

  if (!pnlRows.length) {
    return {
      ok: false,
      status: 502,
      error: `Xero returned an empty P&L for ${fromDate} – ${toDate}. Nothing was saved.`,
    };
  }

  // Totals live on SummaryRows, labelled in cells[0] — see lib/xero/report-rows.ts.
  // `findReportValue` returns null when the label is absent, which we must not
  // collapse to 0: that is how a shape mismatch used to be persisted as a
  // zeroed-out month.
  const revenueFound = findReportValue(pnlRows, 'total income', 'total trading income', 'total revenue');
  const costOfSalesFound = findReportValue(pnlRows, 'total cost of sales');
  const grossProfitFound = findReportValue(pnlRows, 'gross profit');
  const indirectExpensesFound = findReportValue(
    pnlRows,
    'total overhead',
    'total operating expenses',
    'total expenses',
  );
  const netProfitFound = findReportValue(pnlRows, 'net profit', 'profit for the period');
  const otherIncome = findReportValueOrZero(pnlRows, 'total other income');

  if (revenueFound === null && grossProfitFound === null && netProfitFound === null) {
    console.error(
      '[xero/sync] Could not locate any P&L total for',
      fromDate, '–', toDate,
      '— top-level row labels:',
      pnlRows.map((r) => r.title || r.cells?.[0]?.value).join(' | '),
    );
    return {
      ok: false,
      status: 502,
      error:
        'Could not read the Xero P&L — no "Total Income", "Gross Profit" or "Net Profit" row was found. Nothing was saved. The Xero report layout may have changed.',
    };
  }

  const revenue = revenueFound ?? new Decimal(0);
  const costOfSales = costOfSalesFound ?? new Decimal(0);
  const indirectExpenses = indirectExpensesFound ?? new Decimal(0);

  // Labour and marketing — summed from named accounts, because Agero's chart of
  // accounts has no "Direct Labour"/"Indirect Labour" account and these concepts
  // can span several lines. A first-match lookup could express none of them.
  //   Cost of Sales      → "Proj. Wages and Salaries", "Proj. Staff Superannuation"
  //   Operating Expenses → "Indirect Wages", "Marketing"
  // The generic aliases are kept so a renamed/standard account still resolves.
  const directLabourGroup = resolveAccountGroup(pnlRows, {
    lines: ['proj wages and salaries', 'proj staff superannuation', 'direct labour'],
    groupTotals: ['total direct labour'],
  });
  const indirectLabourGroup = resolveAccountGroup(pnlRows, {
    lines: ['indirect wages', 'indirect labour'],
    // If those are a sub-section rather than leaf accounts, there are no
    // matching Rows to sum — fall back to the section's own total.
    groupTotals: ['total indirect wages', 'total indirect labour'],
  });
  // "Educational Associations (Non Marketing)" contains the word marketing but
  // is explicitly not marketing spend; excluded so it cannot be picked up.
  const marketingGroup = resolveAccountGroup(pnlRows, {
    lines: ['marketing'],
    groupTotals: ['total marketing'],
    exclude: ['non marketing'],
  });

  const directLabour = directLabourGroup.total;
  const indirectLabour = indirectLabourGroup.total;
  const marketingExpenses = marketingGroup.total;

  // Agero's chart of accounts does not always emit standalone Gross/Net Profit
  // rows; derive them when Xero omits them.
  const grossProfit = grossProfitFound ?? revenue.minus(costOfSales);
  const netProfit = netProfitFound ?? grossProfit.plus(otherIncome).minus(indirectExpenses);

  // ── 2. Balance Sheet ──────────────────────────────────────────────────────────
  const bsResp = await xero.accountingApi.getReportBalanceSheet(tenantId, toDate);
  const bsRows: ReportRow[] = (bsResp.body.reports?.[0]?.rows ?? []) as unknown as ReportRow[];

  // ── 3. Bank Summary ───────────────────────────────────────────────────────────
  const bankSummaryResp = await xero.accountingApi.getReportBankSummary(tenantId, fromDate, toDate);
  const bankSummaryRows: ReportRow[] = (bankSummaryResp.body.reports?.[0]?.rows ?? []) as unknown as ReportRow[];

  // ── 4. Aged Receivables & Payables (direct fetch — the SDK wrapper requires a contactId) ──
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

  // The balance sheet is the authoritative month-end AR/AP position. Xero's
  // AgedReceivablesByContact/AgedPayablesByContact endpoints require a ContactID
  // and 400 without one, so the aged figures are only a secondary source.
  // Agero's chart of accounts labels these "Accounts Receivable"/"Accounts
  // Payable", not "Trade Debtors"/"Trade Creditors".
  const bsDebtors = findReportValue(
    bsRows,
    'accounts receivable',
    'trade and other receivables',
    'trade debtors',
    'trade receivables',
  );
  const bsCreditors = findReportValue(
    bsRows,
    'accounts payable',
    'trade and other payables',
    'trade creditors',
    'trade payables',
  );

  const effectiveDebtors = bsDebtors ?? tradeDebtors;
  const effectiveCreditors = bsCreditors ?? tradeCreditors;

  const debtorDays = revenue.gt(0) ? effectiveDebtors.div(revenue).mul(30) : new Decimal(0);
  const creditorDays = costOfSales.gt(0) ? effectiveCreditors.div(costOfSales).mul(30) : new Decimal(0);

  // ── Upsert P&L ────────────────────────────────────────────────────────────────
  const pnlValues = {
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
  };

  await prisma.xeroPnL.upsert({
    where: { organisationId_reportMonth: { organisationId, reportMonth: monthKey } },
    update: pnlValues,
    create: { organisationId, reportMonth: monthKey, ...pnlValues },
  });

  // ── Seed bank balances from BankSummary report ────────────────────────────────
  // BankSummary rows: Header row, then data rows with cells[0]=account, cells[4]=closing balance
  let bankCount = 0;
  const upsertBank = async (row: ReportRow) => {
    const accountName = (row.cells?.[0]?.value ?? '').trim();
    if (!accountName || accountName.toLowerCase() === 'total') return;
    const balance = parseAmount(row.cells?.[4]?.value);
    await prisma.xeroBankBalance.upsert({
      where: {
        organisationId_reportMonth_accountName: {
          organisationId,
          reportMonth: monthKey,
          accountName,
        },
      },
      update: { balance: balance.toFixed(2) },
      create: { organisationId, reportMonth: monthKey, accountName, balance: balance.toFixed(2) },
    });
    bankCount++;
  };

  for (const row of bankSummaryRows) {
    const rowType = (row.rowType ?? '').toLowerCase();
    if (rowType === 'row') await upsertBank(row);
    // BankSummary may nest rows inside Sections
    if (rowType === 'section' && Array.isArray(row.rows)) {
      for (const inner of row.rows) {
        if ((inner.rowType ?? '').toLowerCase() === 'row') await upsertBank(inner);
      }
    }
  }

  return {
    ok: true,
    summary: {
      revenue: revenue.toFixed(2),
      costOfSales: costOfSales.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      netProfit: netProfit.toFixed(2),
      grossProfitDerived: grossProfitFound === null,
      netProfitDerived: netProfitFound === null,
      directLabour: directLabour.toFixed(2),
      indirectLabour: indirectLabour.toFixed(2),
      marketingExpenses: marketingExpenses.toFixed(2),
      directLabourAccounts: directLabourGroup.matched,
      indirectLabourAccounts: indirectLabourGroup.matched,
      marketingAccounts: marketingGroup.matched,
      resolution: {
        directLabour: directLabourGroup.source,
        indirectLabour: indirectLabourGroup.source,
        marketing: marketingGroup.source,
      },
      accountLines: listAccountLines(pnlRows),
      tradeDebtors: effectiveDebtors.toFixed(2),
      tradeCreditors: effectiveCreditors.toFixed(2),
      debtorDays: debtorDays.toFixed(1),
      creditorDays: creditorDays.toFixed(1),
      bankAccountsUpdated: bankCount,
      agedReceivablesOk: agedRecRes.ok,
      agedPayablesOk: agedPayRes.ok,
    },
  };
}
