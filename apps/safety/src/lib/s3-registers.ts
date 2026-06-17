// Shared helpers for S3 registers (MSDS currency, test & tag cycle).

export const MSDS_VALIDITY_YEARS = 5;
export const TEST_TAG_CYCLE_MONTHS = 3;

/** Add whole months to a date (used for the test & tag 3-month cycle). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

/** Whole days from now until `date` (negative if past). */
export function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/** Monday (00:00 UTC date-only) of the week containing `date`. */
export function weekStartMonday(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type CurrencyStatus = "current" | "expiring" | "expired" | "unknown";

/** MSDS 5-year currency. Expiring if within 90 days of the 5-year limit. */
export function msdsCurrency(issueDate: Date | null): {
  status: CurrencyStatus;
  expiresOn: Date | null;
  days: number | null;
} {
  if (!issueDate) return { status: "unknown", expiresOn: null, days: null };
  const expiresOn = addYears(issueDate, MSDS_VALIDITY_YEARS);
  const days = daysUntil(expiresOn);
  const status: CurrencyStatus = days < 0 ? "expired" : days <= 90 ? "expiring" : "current";
  return { status, expiresOn, days };
}

/** Test & tag 3-month cycle status from the next-test date. */
export function testTagStatus(nextTestDate: Date): {
  status: CurrencyStatus;
  days: number;
} {
  const days = daysUntil(nextTestDate);
  const status: CurrencyStatus = days < 0 ? "expired" : days <= 14 ? "expiring" : "current";
  return { status, days };
}
