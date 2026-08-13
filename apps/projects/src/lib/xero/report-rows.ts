import Decimal from 'decimal.js';

/**
 * Shared parsing helpers for Xero report responses (xero-node SDK shape).
 *
 * Xero report structure — confirmed against Agero's live P&L / Balance Sheet:
 *
 *   [Header]     title=null      cells=["", "30 Jun 2026", "30 Jun 2025"]
 *   [Section]    title="Bank"    cells=[]
 *     [Row]        title=null    cells=["Agero Main Account-5528", "106366.95", …]
 *     [SummaryRow] title=null    cells=["Total Bank", "209412.55", …]
 *
 * The critical detail: `title` is only ever populated on **Section** rows. Every
 * total ("Total Income", "Gross Profit", "Net Profit", …) is a **SummaryRow**
 * whose label lives in `cells[0].value`, with the amount in `cells[1].value`.
 * A parser that matches on `title` alone will never find a total and silently
 * returns zero for the whole report.
 */

export type XeroReportRow = {
  rowType?: string;
  title?: string;
  cells?: { value?: string }[];
  rows?: XeroReportRow[];
};

/** Parse a Xero cell value into a Decimal. Handles "1,234.56", "(1,234.56)" and "". */
export function parseAmount(value: string | undefined | null): Decimal {
  const raw = (value ?? '').trim();
  if (!raw) return new Decimal(0);
  const negated = /^\(.*\)$/.test(raw); // accounting-style negatives
  const cleaned = raw.replace(/[^0-9.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return new Decimal(0);
  let amount: Decimal;
  try {
    amount = new Decimal(cleaned);
  } catch {
    return new Decimal(0);
  }
  return negated ? amount.negated() : amount;
}

/** The label of a row: Section rows carry it in `title`, all others in `cells[0]`. */
export function rowLabel(row: XeroReportRow): string {
  const title = (row.title ?? '').trim();
  if (title) return title.toLowerCase();
  return (row.cells?.[0]?.value ?? '').trim().toLowerCase();
}

/**
 * Depth-first search for the first row whose label contains `label` AND that
 * actually carries an amount cell. Section headers (cells = []) are skipped as
 * match candidates but are still descended into.
 */
function findRowByLabel(rows: XeroReportRow[], label: string): XeroReportRow | null {
  const needle = label.toLowerCase();
  for (const row of rows) {
    const hasAmount = (row.cells?.length ?? 0) >= 2;
    if (hasAmount && rowLabel(row).includes(needle)) return row;
    if (row.rows?.length) {
      const found = findRowByLabel(row.rows, label);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Find a report value by label, trying each label in priority order.
 *
 * Returns `null` when no matching row exists — distinct from a row that exists
 * and legitimately reads 0.00. Callers must not collapse the two: a missing
 * label means the report shape changed and the sync should fail loudly rather
 * than persist zeros.
 */
export function findReportValue(
  rows: XeroReportRow[],
  ...labels: string[]
): Decimal | null {
  for (const label of labels) {
    const row = findRowByLabel(rows, label);
    if (row) return parseAmount(row.cells?.[1]?.value);
  }
  return null;
}

/** Convenience wrapper for genuinely optional values (individual account lines). */
export function findReportValueOrZero(
  rows: XeroReportRow[],
  ...labels: string[]
): Decimal {
  return findReportValue(rows, ...labels) ?? new Decimal(0);
}
