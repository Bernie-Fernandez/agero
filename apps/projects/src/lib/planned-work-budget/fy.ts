// Pure FY helpers for the Planned Work Budget. Kept out of the 'use server'
// actions file because server-action modules may only export async functions.
// budgetYear is the FY being budgeted (e.g. 2027 for FY27 = Jul 2026–Jun 2027).

export function fyLabel(year: number): string {
  return `FY${String(year).slice(-2)}`;
}

/** Carry-in column = Backlog FY[current] (the year being budgeted); carry-out = Backlog FY[next]. */
export function fyLabels(budgetYear: number): { current: string; next: string } {
  return { current: fyLabel(budgetYear), next: fyLabel(budgetYear + 1) };
}

/** The 12 months of the budget FY: Jul(budgetYear-1) … Jun(budgetYear). */
export function budgetMonths(budgetYear: number): { month: string; label: string }[] {
  const out: { month: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const calMonth = (6 + i) % 12;            // 0-based: Jul=6 … Jun=5
    const calYear = i < 6 ? budgetYear - 1 : budgetYear;
    const d = new Date(Date.UTC(calYear, calMonth, 1));
    out.push({
      month: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-AU', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
    });
  }
  return out;
}

/** Default = next upcoming FY to budget. Australian FY runs Jul–Jun. */
export function defaultBudgetYear(today = new Date()): number {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth() + 1; // 1-12
  return m >= 7 ? y + 2 : y + 1;
}
