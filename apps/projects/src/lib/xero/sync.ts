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
  const expenses = extractSectionData(pnlRows, 'total overhead', 'total expenses');

  // Gross profit and net profit are standalone top-level rows (not inside sections)
  const grossProfit = extractRowValue(pnlRows, 'gross profit');
  const netProfit = extractRowValue(pnlRows, 'net profit');

  const effectiveGrossProfit = grossProfit.isZero()
    ? income.total.minus(cos.total)
    : grossProfit;

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
        netProfit: netProfit.toFixed(2),
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
        netProfit: netProfit.toFixed(2),
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
      netProfit: netProfit.toFixed(2),
      queryStart,
      queryEnd,
    },
  });

  return { ok: true, snapshot };
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
