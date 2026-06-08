import Decimal from 'decimal.js';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { getRefreshedXeroClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

type PnLRow = {
  rowType?: string;
  title?: string;
  cells?: { value?: string }[];
  rows?: PnLRow[];
};

export type AccountLine = { name: string; amount: number };

// ─── Query date helper ────────────────────────────────────────────────────────
// NOTE: The Xero MCP tool (Claude.ai) has a one-month label offset. The
// xero-node REST API does NOT — it returns data for the dates you supply.
// Always query the actual month directly; store under the actual month.

export function getXeroQueryDates(
  actualMonth: number,
  actualYear: number,
): { queryStart: string; queryEnd: string } {
  const queryStart = `${actualYear}-${String(actualMonth).padStart(2, '0')}-01`;
  const lastDay = new Date(actualYear, actualMonth, 0).getDate();
  const queryEnd = `${actualYear}-${String(actualMonth).padStart(2, '0')}-${lastDay}`;
  return { queryStart, queryEnd };
}

// ─── P&L row parsing ─────────────────────────────────────────────────────────

function parseAmt(value: string | undefined): Decimal {
  return new Decimal((value ?? '0').replace(/[^0-9.-]/g, '') || '0');
}

// Finds the section whose SummaryRow title or cell label matches summaryLabel
// (or altLabel as a fallback). This mirrors the approach used by extractReportValue
// in the existing /api/xero/sync route which works correctly in production.
// Agero's Xero uses "Overhead" for expenses (not "Expenses"), so callers pass both.
function extractSectionData(
  topRows: PnLRow[],
  summaryLabel: string,
  altLabel?: string,
): { total: Decimal; accounts: AccountLine[] } {
  for (const row of topRows) {
    if ((row.rowType ?? '').toLowerCase() !== 'section') continue;
    const childRows = row.rows ?? [];

    const summaryRow = childRows.find((child) => {
      if ((child.rowType ?? '').toLowerCase() !== 'summaryrow') return false;
      const title = (child.title ?? '').toLowerCase();
      const cellLabel = (child.cells?.[0]?.value ?? '').toLowerCase();
      const match = (lbl: string) => title.includes(lbl) || cellLabel.includes(lbl);
      return match(summaryLabel) || (altLabel ? match(altLabel) : false);
    });

    if (!summaryRow) continue;

    // cells[1] is the numeric amount; cells[0] is the label text.
    const total = parseAmt(summaryRow.cells?.[1]?.value ?? summaryRow.cells?.[0]?.value);
    const accounts: AccountLine[] = [];
    for (const child of childRows) {
      if ((child.rowType ?? '').toLowerCase() === 'row') {
        const name = (child.cells?.[0]?.value ?? '').trim();
        const amount = parseAmt(child.cells?.[1]?.value);
        if (name) accounts.push({ name, amount: amount.toNumber() });
      }
    }
    return { total, accounts };
  }
  return { total: new Decimal(0), accounts: [] };
}

function extractRowValue(topRows: PnLRow[], label: string): Decimal {
  for (const row of topRows) {
    const titleMatch = (row.title ?? '').toLowerCase().includes(label.toLowerCase());
    const cellMatch = (row.cells?.[0]?.value ?? '').toLowerCase().includes(label.toLowerCase());
    if (titleMatch || cellMatch) {
      return parseAmt(row.cells?.[1]?.value ?? row.cells?.[0]?.value);
    }
  }
  return new Decimal(0);
}

// Agero's expenses live across multiple top-level sections (e.g. Wages, Administration).
// The "Total Overhead" label may be a top-level Row, not a SummaryRow inside a single
// parent Section. extractSectionData misses this. This function handles it by:
//   1. Searching the entire tree recursively for the total label (mirrors extractReportValue).
//   2. Collecting account lines from every Section that sits between Gross Profit and Net Profit
//      in the top-level row list.
function extractExpensesData(topRows: PnLRow[]): { total: Decimal; accounts: AccountLine[] } {
  // Recursive total search — same logic as extractReportValue in /api/xero/sync
  function findTotal(rows: PnLRow[], ...labels: string[]): Decimal {
    for (const row of rows) {
      const title = (row.title ?? '').toLowerCase();
      const cellLabel = (row.cells?.[0]?.value ?? '').toLowerCase();
      for (const lbl of labels) {
        if (title.includes(lbl) || cellLabel.includes(lbl)) {
          return parseAmt(row.cells?.[1]?.value ?? row.cells?.[0]?.value);
        }
      }
      if ((row.rowType ?? '').toLowerCase() === 'section') {
        const found = findTotal(row.rows ?? [], ...labels);
        if (!found.isZero()) return found;
      }
    }
    return new Decimal(0);
  }

  const total = findTotal(topRows, 'total overhead', 'total expenses', 'total operating expenses');

  // Collect Row entries recursively from within a section tree
  function collectRows(rows: PnLRow[], accounts: AccountLine[]) {
    for (const row of rows) {
      if ((row.rowType ?? '').toLowerCase() === 'row') {
        const name = (row.cells?.[0]?.value ?? '').trim();
        const amount = parseAmt(row.cells?.[1]?.value);
        if (name) accounts.push({ name, amount: amount.toNumber() });
      } else if ((row.rowType ?? '').toLowerCase() === 'section') {
        collectRows(row.rows ?? [], accounts);
      }
    }
  }

  const accounts: AccountLine[] = [];
  let afterGrossProfit = false;

  for (const row of topRows) {
    const rt = (row.rowType ?? '').toLowerCase();
    const title = (row.title ?? '').toLowerCase();
    const cellLabel = (row.cells?.[0]?.value ?? '').toLowerCase();

    if (!afterGrossProfit) {
      if (title.includes('gross profit') || cellLabel.includes('gross profit')) {
        afterGrossProfit = true;
      }
      continue;
    }
    if (title.includes('net profit') || cellLabel.includes('net profit')) break;

    if (rt === 'section') {
      collectRows(row.rows ?? [], accounts);
    }
  }

  return { total, accounts };
}

// ─── Main sync action ─────────────────────────────────────────────────────────

type PnLSnapshot = Awaited<ReturnType<typeof prisma.xeroPnLSnapshot.upsert>>;

export async function pullXeroPnLMonth(
  actualMonth: number,
  actualYear: number,
  userId: string,
): Promise<{ ok: boolean; snapshot?: PnLSnapshot; error?: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: 'User not found.' };

  const orgId = user.organisationId;

  // Get refreshed Xero client (handles token refresh)
  const xero = await getRefreshedXeroClient(orgId);
  if (!xero) {
    return {
      ok: false,
      error: 'Xero connection expired. Please reconnect Xero in Settings.',
    };
  }

  const conn = await prisma.xeroConnection.findUnique({ where: { organisationId: orgId } });
  const tenantId = conn?.xeroTenantId ?? xero.tenants[0]?.tenantId;
  if (!tenantId) {
    return { ok: false, error: 'No Xero tenant found. Please reconnect Xero in Settings.' };
  }

  const { queryStart, queryEnd } = getXeroQueryDates(actualMonth, actualYear);

  let pnlRows: PnLRow[];
  try {
    const resp = await xero.accountingApi.getReportProfitAndLoss(
      tenantId,
      queryStart,
      queryEnd,
    );
    pnlRows = (resp.body.reports?.[0]?.rows ?? []) as unknown as PnLRow[];
  } catch (err) {
    console.error('[xero-sync] Xero API error for', actualMonth, actualYear, err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('401') || msg.includes('token')) {
      return {
        ok: false,
        error: 'Xero connection expired. Please reconnect Xero in Settings.',
      };
    }
    return { ok: false, error: `Xero API error: ${msg}` };
  }

  if (!pnlRows.length) {
    return {
      ok: false,
      error: 'No data returned from Xero for this period. The period may not have any transactions.',
    };
  }

  // Parse sections — find each section by its SummaryRow label.
  // Agero's Xero uses "Total Overhead" for the expenses SummaryRow (not "Total Expenses").
  const income = extractSectionData(pnlRows, 'total income');
  const cos = extractSectionData(pnlRows, 'total cost of sales');
  const otherIncome = extractSectionData(pnlRows, 'other income');
  const expenses = extractExpensesData(pnlRows);

  // Gross profit and net profit are standalone top-level rows (not inside sections)
  const grossProfit = extractRowValue(pnlRows, 'gross profit');
  const netProfit = extractRowValue(pnlRows, 'net profit');

  const effectiveGrossProfit = grossProfit.isZero()
    ? income.total.minus(cos.total)
    : grossProfit;

  // Net profit: prefer the Xero-reported value; fall back to formula when Xero
  // doesn't emit a standalone "Net Profit" row (Agero's chart of accounts omits it).
  const effectiveNetProfit = netProfit.isZero()
    ? effectiveGrossProfit.plus(otherIncome.total).minus(expenses.total)
    : netProfit;

  // Period dates (the ACTUAL month, not the query month)
  const periodStart = new Date(Date.UTC(actualYear, actualMonth - 1, 1));
  const periodEnd = new Date(Date.UTC(actualYear, actualMonth, 0)); // last day of month

  const xeroReportLink = `https://go.xero.com/Reports/Report.aspx?reportType=ProfitAndLoss&fromDate=${new Date(Date.UTC(actualYear, actualMonth - 1, 1)).toISOString().split('T')[0]}&toDate=${periodEnd.toISOString().split('T')[0]}`;

  let snapshot: PnLSnapshot;
  try {
    snapshot = await prisma.xeroPnLSnapshot.upsert({
      where: {
        organisationId_year_month: {
          organisationId: orgId,
          year: actualYear,
          month: actualMonth,
        },
      },
      update: {
        periodStart,
        periodEnd,
        totalIncome: income.total.toFixed(2),
        totalCostOfSales: cos.total.toFixed(2),
        grossProfit: effectiveGrossProfit.toFixed(2),
        totalOtherIncome: otherIncome.total.toFixed(2),
        totalExpenses: expenses.total.toFixed(2),
        netProfit: effectiveNetProfit.toFixed(2),
        incomeAccountsJson: income.accounts,
        cosAccountsJson: cos.accounts,
        expenseAccountsJson: expenses.accounts,
        otherIncomeJson: otherIncome.accounts,
        xeroReportLink,
        pulledAt: new Date(),
        pulledBy: userId,
      },
      create: {
        organisationId: orgId,
        month: actualMonth,
        year: actualYear,
        periodStart,
        periodEnd,
        totalIncome: income.total.toFixed(2),
        totalCostOfSales: cos.total.toFixed(2),
        grossProfit: effectiveGrossProfit.toFixed(2),
        totalOtherIncome: otherIncome.total.toFixed(2),
        totalExpenses: expenses.total.toFixed(2),
        netProfit: effectiveNetProfit.toFixed(2),
        incomeAccountsJson: income.accounts,
        cosAccountsJson: cos.accounts,
        expenseAccountsJson: expenses.accounts,
        otherIncomeJson: otherIncome.accounts,
        xeroReportLink,
        pulledBy: userId,
      },
    });
  } catch (err) {
    console.error('[xero-sync] DB upsert failed for', actualMonth, actualYear, err);
    return { ok: false, error: 'Sync failed — no data was saved. Please try again.' };
  }

  await createAuditLog({
    userId,
    action: 'XERO_PNL_SYNCED',
    entity: 'XeroPnLSnapshot',
    entityId: snapshot.id,
    detail: {
      month: actualMonth,
      year: actualYear,
      totalIncome: income.total.toFixed(2),
      netProfit: effectiveNetProfit.toFixed(2),
      queryStart,
      queryEnd,
    },
  });

  return { ok: true, snapshot };
}

// ─── Balance Sheet row parsing ────────────────────────────────────────────────

type BSRow = {
  rowType?: string;
  title?: string;
  cells?: { value?: string }[];
  rows?: BSRow[];
};

function bsParseAmt(value: string | undefined): Decimal {
  return new Decimal((value ?? '0').replace(/[^0-9.-]/g, '') || '0');
}

// Recursively search for a SummaryRow or Row whose first cell matches any of the labels
function bsFindValue(rows: BSRow[], ...labels: string[]): Decimal {
  for (const row of rows) {
    const cellLabel = (row.cells?.[0]?.value ?? '').toLowerCase();
    const title = (row.title ?? '').toLowerCase();
    for (const lbl of labels) {
      const l = lbl.toLowerCase();
      if (cellLabel.includes(l) || title.includes(l)) {
        return bsParseAmt(row.cells?.[1]?.value ?? row.cells?.[0]?.value);
      }
    }
    if (row.rows?.length) {
      const found = bsFindValue(row.rows, ...labels);
      if (!found.isZero()) return found;
    }
  }
  return new Decimal(0);
}

// Sum all Row amounts within sections whose title matches the label (e.g. "Bank" accounts)
function bsSumRows(rows: BSRow[], ...nameParts: string[]): Decimal {
  let sum = new Decimal(0);
  for (const row of rows) {
    const rt = (row.rowType ?? '').toLowerCase();
    const cellLabel = (row.cells?.[0]?.value ?? '').toLowerCase();
    if (rt === 'row') {
      for (const part of nameParts) {
        if (cellLabel.includes(part.toLowerCase())) {
          sum = sum.plus(bsParseAmt(row.cells?.[1]?.value));
          break;
        }
      }
    }
    if (row.rows?.length) {
      sum = sum.plus(bsSumRows(row.rows, ...nameParts));
    }
  }
  return sum;
}

export async function pullXeroBalanceSheetMonth(
  actualMonth: number,
  actualYear: number,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: 'User not found.' };

  const orgId = user.organisationId;
  const xero = await getRefreshedXeroClient(orgId);
  if (!xero) return { ok: false, error: 'Xero connection expired. Please reconnect Xero in Settings.' };

  const conn = await prisma.xeroConnection.findUnique({ where: { organisationId: orgId } });
  const tenantId = conn?.xeroTenantId ?? xero.tenants[0]?.tenantId;
  if (!tenantId) return { ok: false, error: 'No Xero tenant found. Please reconnect Xero in Settings.' };

  const lastDay = new Date(actualYear, actualMonth, 0).getDate();
  const dateStr = `${actualYear}-${String(actualMonth).padStart(2, '0')}-${lastDay}`;

  let bsRows: BSRow[];
  try {
    const resp = await xero.accountingApi.getReportBalanceSheet(tenantId, dateStr);
    bsRows = (resp.body.reports?.[0]?.rows ?? []) as unknown as BSRow[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[xero-bs] API error for', actualMonth, actualYear, err);
    if (msg.includes('401') || msg.includes('token')) {
      return { ok: false, error: 'Xero connection expired. Please reconnect Xero in Settings.' };
    }
    return { ok: false, error: `Xero API error: ${msg}` };
  }

  if (!bsRows.length) {
    return { ok: false, error: 'No Balance Sheet data returned from Xero for this period.' };
  }

  const totalCurrentAssets         = bsFindValue(bsRows, 'total current assets');
  const totalNonCurrentAssets      = bsFindValue(bsRows, 'total non-current assets', 'total fixed assets', 'total non current assets');
  const totalAssets                = bsFindValue(bsRows, 'total assets');
  const totalCurrentLiabilities    = bsFindValue(bsRows, 'total current liabilities');
  const totalNonCurrentLiabilities = bsFindValue(bsRows, 'total non-current liabilities', 'total non current liabilities');
  const totalLiabilities           = bsFindValue(bsRows, 'total liabilities');
  const totalEquity                = bsFindValue(bsRows, 'total equity');

  // Specific line items — sum all rows whose name contains bank/cash keywords
  const cashAndBankBalances = bsSumRows(bsRows, 'bank', 'cash');
  const accountsReceivable  = bsFindValue(bsRows, 'trade and other receivables', 'accounts receivable', 'debtors', 'receivables');
  const accountsPayable     = bsFindValue(bsRows, 'trade and other payables', 'accounts payable', 'creditors', 'payables');
  const retentionsHeld      = bsFindValue(bsRows, 'retentions', '9100');
  const wipAsset            = bsFindValue(bsRows, 'wip asset', '640', 'work in progress');

  const snapshotDate = new Date(Date.UTC(actualYear, actualMonth - 1, lastDay));
  const reportMonth  = new Date(Date.UTC(actualYear, actualMonth - 1, 1));

  const decOrNull = (d: Decimal) => (d.isZero() ? null : d.toFixed(2));

  try {
    await prisma.xeroBalanceSheetSnapshot.upsert({
      where: { organisationId_reportMonth: { organisationId: orgId, reportMonth } },
      update: {
        snapshotDate,
        totalCurrentAssets:         decOrNull(totalCurrentAssets),
        totalNonCurrentAssets:      decOrNull(totalNonCurrentAssets),
        totalAssets:                decOrNull(totalAssets),
        totalCurrentLiabilities:    decOrNull(totalCurrentLiabilities),
        totalNonCurrentLiabilities: decOrNull(totalNonCurrentLiabilities),
        totalLiabilities:           decOrNull(totalLiabilities),
        totalEquity:                decOrNull(totalEquity),
        cashAndBankBalances:        decOrNull(cashAndBankBalances),
        accountsReceivable:         decOrNull(accountsReceivable),
        accountsPayable:            decOrNull(accountsPayable),
        retentionsHeld:             decOrNull(retentionsHeld),
        wipAsset:                   decOrNull(wipAsset),
        rawJson:                    JSON.parse(JSON.stringify(bsRows)),
        syncedAt:                   new Date(),
        syncedBy:                   userId,
      },
      create: {
        organisationId: orgId,
        snapshotDate,
        reportMonth,
        totalCurrentAssets:         decOrNull(totalCurrentAssets),
        totalNonCurrentAssets:      decOrNull(totalNonCurrentAssets),
        totalAssets:                decOrNull(totalAssets),
        totalCurrentLiabilities:    decOrNull(totalCurrentLiabilities),
        totalNonCurrentLiabilities: decOrNull(totalNonCurrentLiabilities),
        totalLiabilities:           decOrNull(totalLiabilities),
        totalEquity:                decOrNull(totalEquity),
        cashAndBankBalances:        decOrNull(cashAndBankBalances),
        accountsReceivable:         decOrNull(accountsReceivable),
        accountsPayable:            decOrNull(accountsPayable),
        retentionsHeld:             decOrNull(retentionsHeld),
        wipAsset:                   decOrNull(wipAsset),
        rawJson:                    JSON.parse(JSON.stringify(bsRows)),
        syncedBy:                   userId,
      },
    });
  } catch (err) {
    console.error('[xero-bs] DB upsert failed for', actualMonth, actualYear, err);
    return { ok: false, error: 'Sync failed — no data was saved. Please try again.' };
  }

  await createAuditLog({
    userId,
    action: 'XERO_BS_SYNCED',
    entity: 'XeroBalanceSheetSnapshot',
    entityId: `${orgId}:${actualYear}-${actualMonth}`,
    detail: { month: actualMonth, year: actualYear, totalAssets: decOrNull(totalAssets) },
  });

  return { ok: true };
}

export async function pullXeroBalanceSheetRange(
  fromMonth: number,
  fromYear: number,
  toMonth: number,
  toYear: number,
  userId: string,
): Promise<{ ok: boolean; pulled: number; errors: string[] }> {
  const errors: string[] = [];
  let pulled = 0;
  let month = fromMonth;
  let year = fromYear;

  while (year < toYear || (year === toYear && month <= toMonth)) {
    const result = await pullXeroBalanceSheetMonth(month, year, userId);
    if (result.ok) {
      pulled++;
    } else {
      const label = new Date(year, month - 1, 1).toLocaleString('en-AU', { month: 'long', year: 'numeric' });
      errors.push(`${label}: ${result.error ?? 'Unknown error'}`);
      console.error('[xero-bs] Range pull failed for', month, year, result.error);
    }
    month++;
    if (month > 12) { month = 1; year++; }
  }

  return { ok: errors.length === 0, pulled, errors };
}

// ─── Range backfill action ────────────────────────────────────────────────────

export async function pullXeroPnLRange(
  fromMonth: number,
  fromYear: number,
  toMonth: number,
  toYear: number,
  userId: string,
): Promise<{ ok: boolean; pulled: number; errors: string[] }> {
  const errors: string[] = [];
  let pulled = 0;

  let month = fromMonth;
  let year = fromYear;

  while (year < toYear || (year === toYear && month <= toMonth)) {
    const result = await pullXeroPnLMonth(month, year, userId);
    if (result.ok) {
      pulled++;
    } else {
      const label = new Date(year, month - 1, 1).toLocaleString('en-AU', { month: 'long', year: 'numeric' });
      errors.push(`${label}: ${result.error ?? 'Unknown error'}`);
      console.error('[xero-sync] Range pull failed for', month, year, result.error);
    }

    // Advance to next month
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return { ok: errors.length === 0, pulled, errors };
}
