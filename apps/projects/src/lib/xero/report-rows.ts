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
 * Normalise a label for comparison: lowercase, drop punctuation, collapse
 * whitespace. Lets a needle like "proj wages and salaries" match Xero's
 * "Proj. Wages and Salaries" without the caller having to guess the exact
 * punctuation used in the chart of accounts.
 */
function normalise(text: string): string {
  return text
    .toLowerCase()
    // Punctuation becomes a space rather than vanishing, so word boundaries
    // survive: "(Non Marketing)" → "non marketing", "Non-Marketing" → "non marketing".
    .replace(/[.,'"()[\]/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Does `label` contain `needle` starting at a word boundary?
 *
 * The boundary matters: a plain substring test makes "Indirect Labour" satisfy
 * a needle of "direct labour", which would sweep overhead labour into the
 * direct labour total. Trailing text is still allowed, so "Indirect Wages
 * Accrual" still matches "indirect wages".
 */
function labelMatches(label: string, needle: string): boolean {
  const index = label.indexOf(needle);
  if (index === -1) return false;
  return index === 0 || !/[a-z0-9]/.test(label[index - 1]);
}

/**
 * Depth-first search for the first row whose label contains `label` AND that
 * actually carries an amount cell. Section headers (cells = []) are skipped as
 * match candidates but are still descended into.
 */
function findRowByLabel(rows: XeroReportRow[], label: string): XeroReportRow | null {
  const needle = normalise(label);
  for (const row of rows) {
    const hasAmount = (row.cells?.length ?? 0) >= 2;
    if (hasAmount && labelMatches(normalise(rowLabel(row)), needle)) return row;
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

export type MatchedAccountLine = { name: string; amount: string };

/**
 * Every account line in the report, in document order. Used to record what the
 * report actually contained, so a field that resolves to zero can be told apart
 * from a field whose account has been renamed.
 */
export function listAccountLines(rows: XeroReportRow[]): MatchedAccountLine[] {
  const lines: MatchedAccountLine[] = [];
  const walk = (current: XeroReportRow[]) => {
    for (const row of current) {
      if ((row.rowType ?? '').toLowerCase() === 'row' && (row.cells?.length ?? 0) >= 2) {
        const name = (row.cells?.[0]?.value ?? '').trim();
        if (name) lines.push({ name, amount: parseAmount(row.cells?.[1]?.value).toFixed(2) });
      }
      if (row.rows?.length) walk(row.rows);
    }
  };
  walk(rows);
  return lines;
}

/**
 * Sum every account line whose label matches any of `labels`.
 *
 * Only `Row` entries are considered — SummaryRow totals and Section headers are
 * skipped, so a "Total Wages" row can never be added on top of the lines it
 * already aggregates. Each row is visited once, so a line matching two labels
 * is still only counted once.
 *
 * Unlike `findReportValue`, this does not stop at the first hit: a single
 * reporting concept can span several accounts (Agero's direct labour is
 * "Proj. Wages and Salaries" + "Proj. Staff Superannuation"). The matched line
 * names are returned so callers can surface exactly what was picked up.
 */
export function sumAccountLines(
  rows: XeroReportRow[],
  labels: string[],
  options: { exclude?: string[] } = {},
): { total: Decimal; matched: MatchedAccountLine[] } {
  const needles = labels.map(normalise).filter(Boolean);
  const excluded = (options.exclude ?? []).map(normalise).filter(Boolean);
  const matched: MatchedAccountLine[] = [];
  let total = new Decimal(0);

  const walk = (current: XeroReportRow[]) => {
    for (const row of current) {
      const isAccountLine =
        (row.rowType ?? '').toLowerCase() === 'row' && (row.cells?.length ?? 0) >= 2;
      if (isAccountLine) {
        const label = normalise(rowLabel(row));
        const isExcluded = excluded.some((needle) => label.includes(needle));
        if (!isExcluded && needles.some((needle) => labelMatches(label, needle))) {
          const amount = parseAmount(row.cells?.[1]?.value);
          total = total.plus(amount);
          matched.push({ name: (row.cells?.[0]?.value ?? '').trim(), amount: amount.toFixed(2) });
        }
      }
      if (row.rows?.length) walk(row.rows);
    }
  };
  walk(rows);

  return { total, matched };
}
