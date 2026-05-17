/**
 * Validation script: March 2026 Finance Report
 *
 * Checks every financial calculation for the March 2026 management report against
 * known-correct values derived from the source Excel and confirmed DB entries.
 *
 * Replicates the exact logic of calcBusinessUnitSummary and calcConsolidatedPnL
 * from src/lib/finance/calculations.ts using raw SQL so it runs standalone.
 *
 * Exit code 1 if any check fails.
 *
 * Usage:
 *   node apps/projects/scripts/validate-finance-march-2026.mjs
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: 'apps/projects/.env.local' });
import pg from 'pg';
const { Client } = pg;

// ─── Constants ────────────────────────────────────────────────────────────────

const ORG_ID = 'a1000000-0000-0000-0000-000000000001';
const FY = 2026;

// Canonical March 2026 (UTC midnight) — correct representation for Vercel/UTC servers.
// On AEDT dev machines the seed stored xero_pnl with 2026-02-28T13:00Z; this script
// handles that via AEDT-tolerant lookup so tests reflect data correctness, not tz storage.
const REPORT_MONTH = new Date('2026-03-01T00:00:00.000Z');

// ─── Replication of calculations.ts helpers ───────────────────────────────────

function n(v) {
  if (v == null) return 0;
  const x = parseFloat(String(v));
  return isNaN(x) ? 0 : x;
}

function getFinancialYear(date) {
  const month = date.getUTCMonth() + 1;
  return month >= 7 ? date.getUTCFullYear() + 1 : date.getUTCFullYear();
}

function getMonthsYtd(reportMonth) {
  const fy = getFinancialYear(reportMonth);
  const months = [];
  for (let m = 7; m <= 12; m++) {
    const d = new Date(Date.UTC(fy - 1, m - 1, 1));
    if (d <= reportMonth) months.push(d);
  }
  for (let m = 1; m <= 6; m++) {
    const d = new Date(Date.UTC(fy, m - 1, 1));
    if (d <= reportMonth) months.push(d);
  }
  return months;
}

function getMonthBudgetKey(d) {
  return ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'][d.getUTCMonth()];
}

function monthKeyOf(d) {
  return new Date(d).toISOString().slice(0, 7); // 'YYYY-MM'
}

const SF_MONTHS = ['jul','aug','sep','oct','nov','dec','jan','feb','mar','apr','may','jun'];

function ytdMonthKeys(ytdDates) {
  return ytdDates.map(d =>
    SF_MONTHS[d.getUTCMonth() >= 6 ? d.getUTCMonth() - 6 : d.getUTCMonth() + 6]
  );
}

// ─── AEDT-tolerant xero_pnl row lookup ────────────────────────────────────────
// The seed script was run in AEDT (UTC+11), so March 1 00:00 AEDT was stored as
// Feb 28 13:00 UTC. When the UTC timestamp and AEDT-apparent timestamp fall in
// different calendar months, the AEDT interpretation is authoritative (that is
// when the boundary crossing happens). We never double-count: a row that crosses
// a month boundary is matched ONLY by its AEDT apparent month, not its UTC month.
const AEDT_OFFSET_MS = 11 * 3600 * 1000;

function findPnlForMonth(pnlRows, targetMonthUTC) {
  const targetKey = monthKeyOf(targetMonthUTC);
  return pnlRows.find(p => {
    const stored  = new Date(p.report_month);
    const utcKey  = monthKeyOf(stored);
    const apparent = new Date(stored.getTime() + AEDT_OFFSET_MS);
    const aedtKey = monthKeyOf(apparent);
    if (utcKey !== aedtKey) {
      // AEDT shift crossed a calendar-month boundary — use AEDT interpretation only
      return aedtKey === targetKey;
    }
    // No boundary crossing — UTC and AEDT agree; match by UTC key
    return utcKey === targetKey;
  });
}

// ─── Budget line groupings (mirror of calculations.ts) ────────────────────────

const BUDGET_REVENUE_LINES = new Set(['BF Sales']);
const BUDGET_COS_LINES = new Set([
  'Proj. Costs - Building Surveyors',
  'Proj. Costs - Client Specific Gifts',
  'Proj. Costs - Consultants/Engineers',
  'Proj. Costs - Contractors and Suppliers',
  'Proj. Costs - Design/Arch. Costs',
  'Proj. Costs - Management Costs',
  'Proj. Costs - Parking',
  'Proj. Costs - Prelim and General Other',
  'Proj. Costs - Referral Fees',
  'Proj. Costs - Specific Site Allowances/OHS/Site Equipment',
  'Proj. Costs - Travel National',
  'Proj Other Costs Fuel / Tolls',
]);
const BUDGET_DL_LINES = new Set([
  'Proj. Wages and Salaries',
  'Proj. Staff Superannuation',
  'Proj. Staff - Car Allowance',
]);
const BUDGET_IL_LINES = new Set([
  'Admin - Wages and Salaries',
  'Admin Staff - Superannuation',
  'Directors - Wages, Salary',
  'Directors - Superannuation',
  'Directors - EO Costs',
]);
const BUDGET_MKT_LINES = new Set([
  'Marketing - Advertising',
  'Marketing - Entertainment',
  'Marketing - Events',
  'Marketing - General',
  'Marketing - Graphics/Website Design/Co Collateral',
]);
const BUDGET_SKIP_SET = new Set([
  ...BUDGET_REVENUE_LINES,
  ...BUDGET_COS_LINES,
  ...BUDGET_DL_LINES,
  ...BUDGET_IL_LINES,
  ...BUDGET_MKT_LINES,
  'Awarded Projects Margin Budget',
  'Backlog Projects Margin Budget',
]);

// ─── Check harness ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function check(label, actual, expected, toleranceCents = 51) {
  // toleranceCents: 51 = $0.51 tolerance (handles integer-rounded expected values)
  const diff = Math.abs(actual - expected);
  const ok = diff <= toleranceCents / 100;
  const fmt = v => v.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
  if (ok) {
    console.log(`  ✅ PASS  ${label.padEnd(52)} = ${fmt(actual)}`);
    passed++;
  } else {
    const msg = `  ❌ FAIL  ${label.padEnd(52)} actual=${fmt(actual)}  expected=${fmt(expected)}  diff=${(actual - expected).toFixed(2)}`;
    console.log(msg);
    failures.push({ label, actual, expected, diff: actual - expected });
    failed++;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// Load all required data
const pnlRes    = await client.query(`SELECT * FROM projects.xero_pnl WHERE organisation_id = $1`, [ORG_ID]);
const budgetRes = await client.query(`SELECT * FROM projects.annual_budgets WHERE organisation_id = $1 AND financial_year = $2`, [ORG_ID, FY]);
const sfRes     = await client.query(`SELECT * FROM projects.secured_forecasts WHERE organisation_id = $1 AND financial_year = $2`, [ORG_ID, FY]);

const pnlRows   = pnlRes.rows;
const budgetRows = budgetRes.rows;
const sfRows    = sfRes.rows;

// Derived month sets
const ytdMonths    = getMonthsYtd(REPORT_MONTH);            // e.g. [Jul-25 … Mar-26]
const ytdKeys      = ytdMonthKeys(ytdMonths);               // ['jul','aug',…,'mar']
const remainingKeys = SF_MONTHS.filter(m => !ytdKeys.includes(m)); // ['apr','may','jun']
const reportMonthKey = getMonthBudgetKey(REPORT_MONTH);     // 'mar'

// This-month xero_pnl (AEDT-tolerant)
const thisMonthPnl = findPnlForMonth(pnlRows, REPORT_MONTH);

// ─── Budget calculation helpers ───────────────────────────────────────────────

const bSum = (lineSet, key) =>
  budgetRows.filter(r => lineSet.has(r.line_item))
    .reduce((s, r) => s + n(r[key]), 0);

const bIndExp = (key) =>
  budgetRows.filter(r => !BUDGET_SKIP_SET.has(r.line_item))
    .reduce((s, r) => s + n(r[key]), 0);

const bSumYtd = (lineSet) =>
  ytdMonths.reduce((s, m) => s + bSum(lineSet, getMonthBudgetKey(m)), 0);

const bIndExpYtd = () =>
  ytdMonths.reduce((s, m) => s + bIndExp(getMonthBudgetKey(m)), 0);

// ─── This-month budget ────────────────────────────────────────────────────────

const tmBudRev = bSum(BUDGET_REVENUE_LINES, reportMonthKey);
const tmBudCoS = bSum(BUDGET_COS_LINES, reportMonthKey);
const tmBudDL  = bSum(BUDGET_DL_LINES, reportMonthKey);
const tmBudGP  = tmBudRev - tmBudCoS - tmBudDL;
const tmBudIE  = bIndExp(reportMonthKey);
const tmBudIL  = bSum(BUDGET_IL_LINES, reportMonthKey);
const tmBudMkt = bSum(BUDGET_MKT_LINES, reportMonthKey);
const tmBudNP  = tmBudGP - tmBudIE - tmBudIL - tmBudMkt;

// ─── YTD budget ───────────────────────────────────────────────────────────────

const ytdBudRev = bSumYtd(BUDGET_REVENUE_LINES);
const ytdBudCoS = bSumYtd(BUDGET_COS_LINES);
const ytdBudDL  = bSumYtd(BUDGET_DL_LINES);
const ytdBudGP  = ytdBudRev - ytdBudCoS - ytdBudDL;
const ytdBudIE  = bIndExpYtd();
const ytdBudIL  = bSumYtd(BUDGET_IL_LINES);
const ytdBudMkt = bSumYtd(BUDGET_MKT_LINES);
const ytdBudNP  = ytdBudGP - ytdBudIE - ytdBudIL - ytdBudMkt;

// ─── YTD actuals: sum across all YTD months ───────────────────────────────────

function sumYtd(field) {
  return ytdMonths.reduce((s, m) => {
    const rec = findPnlForMonth(pnlRows, m);
    return s + (rec ? n(rec[field]) : 0);
  }, 0);
}

const ytdRevenue = sumYtd('revenue');
const ytdGP      = sumYtd('gross_profit');
const ytdNP      = sumYtd('net_profit_before_tax');

// ─── Business Unit Summary ────────────────────────────────────────────────────
// Reads ytd margin fields stored directly on the xero_pnl row (entered manually
// from the (B) Budget sheet in the management report Excel).

const awardedGpYtd    = thisMonthPnl ? n(thisMonthPnl.awarded_gross_profit_ytd) : null;
const backlogGpYtd    = thisMonthPnl ? n(thisMonthPnl.backlog_gross_profit_ytd) : null;
const awardedYtdBudget = thisMonthPnl ? n(thisMonthPnl.awarded_ytd_budget_margin) : 0;
const backlogYtdBudget = thisMonthPnl ? n(thisMonthPnl.backlog_ytd_budget_margin) : 0;
const netCashFlow     = thisMonthPnl ? n(thisMonthPnl.net_project_cash_flow) : null;

const sfMargin = (status, months) =>
  sfRows.filter(r => r.status === status)
    .reduce((s, r) => s + months.reduce((ms, m) => ms + n(r[m]), 0), 0);

const awardedFyForecast = (awardedGpYtd ?? 0) + sfMargin('AWARDED', remainingKeys);
const backlogFyForecast = (backlogGpYtd ?? 0) + sfMargin('BACKLOG', remainingKeys);

const awardedBudgetRow = budgetRows.find(r => r.line_item.toLowerCase().includes('awarded'));
const backlogBudgetRow = budgetRows.find(r => r.line_item.toLowerCase().includes('backlog'));
const awardedFyBudget  = awardedBudgetRow ? n(awardedBudgetRow.total) : null;
const backlogFyBudget  = backlogBudgetRow ? n(backlogBudgetRow.total) : null;

const totalGpYtd          = (awardedGpYtd ?? 0) + (backlogGpYtd ?? 0);
const netCashVsGrossMargin = netCashFlow !== null ? netCashFlow - totalGpYtd : null;

// ─── Print header ─────────────────────────────────────────────────────────────

const line = '═'.repeat(80);
console.log('\n' + line);
console.log('  VALIDATION REPORT — March 2026 Finance Report');
console.log(line);
console.log(`  Report month (UTC):     ${REPORT_MONTH.toISOString()}`);
console.log(`  Financial year:         FY${FY}`);
console.log(`  YTD months (${String(ytdMonths.length).padStart(2)}):       ${ytdMonths.map(m => getMonthBudgetKey(m)).join(', ')}`);
console.log(`  Remaining FY months:    ${remainingKeys.join(', ')}`);
console.log(`  xero_pnl rows in DB:    ${pnlRows.length}`);
console.log(`  This-month row found:   ${thisMonthPnl ? 'YES — ' + new Date(thisMonthPnl.report_month).toISOString() : 'NO ❌ (timezone bug — xero_pnl stored as AEDT)'}`);
console.log(`  Budget rows:            ${budgetRows.length}`);
console.log(`  Secured forecast rows:  ${sfRows.length}`);
console.log(line);

// ─── Section 1: Business Unit Summary ────────────────────────────────────────

console.log('\n  ── Business Unit Summary ──\n');
check('Awarded YTD Actual Margin',       awardedGpYtd ?? 0,         668338.08,  1);
check('Awarded YTD Budget',              awardedYtdBudget,           500009.46,  1);
check('Awarded FY Forecast',             awardedFyForecast,          768433.59,  1);
check('Awarded FY Budget',               awardedFyBudget ?? 0,      1703244.46,  1);
check('Backlog YTD Actual Margin',       backlogGpYtd ?? 0,          598262.99,  1);
check('Backlog YTD Budget',              backlogYtdBudget,            248531.54,  1);
check('Backlog FY Forecast',             backlogFyForecast,           605076.22,  1);
check('Backlog FY Budget',               backlogFyBudget ?? 0,        248531.54,  1);
check('Net Project Cash Flow',           netCashFlow ?? 0,           1128241.58,  1);
check('Net Cash vs Gross Margin',        netCashVsGrossMargin ?? 0,  -138359.49,  1);

// ─── Section 2: Consolidated P&L — This Month ────────────────────────────────

console.log('\n  ── Consolidated P&L — This Month ──\n');
const tmRevActual = thisMonthPnl ? n(thisMonthPnl.revenue) : 0;
const tmGpActual  = thisMonthPnl ? n(thisMonthPnl.gross_profit) : 0;
const tmNpActual  = thisMonthPnl ? n(thisMonthPnl.net_profit_before_tax) : 0;

check('TM Revenue Actual',               tmRevActual,     121356,   51);
check('TM Revenue Budget',               tmBudRev,        400000,    1);
check('TM Gross Profit Actual',          tmGpActual,       66410,   51);
check('TM Gross Profit Budget',          tmBudGP,          48647,    1);
check('TM Net Profit Actual',            tmNpActual,      -17174,   51);
check('TM Net Profit Budget',            tmBudNP,         -50632,    1);

// ─── Section 3: Consolidated P&L — YTD ───────────────────────────────────────

console.log('\n  ── Consolidated P&L — YTD ──\n');

// Diagnostic: show which YTD months have xero_pnl data
const ytdCoverage = ytdMonths.map(m => {
  const rec = findPnlForMonth(pnlRows, m);
  return `${getMonthBudgetKey(m)}:${rec ? '✓' : '✗'}`;
});
console.log(`  YTD xero_pnl coverage: ${ytdCoverage.join('  ')}\n`);

check('YTD Revenue Actual',              ytdRevenue,   3810487,   51);
check('YTD Revenue Budget',              ytdBudRev,    4675000,    1);
check('YTD Gross Profit Actual',         ytdGP,         931584,   51);
check('YTD Net Profit Actual',           ytdNP,         -20442,   51);

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('\n' + line);
const overall = failed === 0 ? '✅ ALL PASS' : `❌ ${failed} FAILED`;
console.log(`  RESULT: ${overall}  (${passed} passed, ${failed} failed)`);

if (failures.length > 0) {
  console.log('\n  Failed checks:');
  for (const f of failures) {
    console.log(`    ❌ ${f.label}: diff=${f.diff.toFixed(2)}`);
  }

  console.log('\n  Likely root causes:');
  const hasXeroMissing = ytdMonths.some(m => !findPnlForMonth(pnlRows, m));
  if (hasXeroMissing) {
    const missing = ytdMonths.filter(m => !findPnlForMonth(pnlRows, m)).map(m => getMonthBudgetKey(m));
    console.log(`    • Missing xero_pnl rows for: ${missing.join(', ')}`);
    console.log('      → YTD actuals will be wrong until all months are seeded');
  }
  if (!thisMonthPnl) {
    console.log('    • This-month xero_pnl not found — timezone bug in stored report_month');
    console.log('      → UPDATE projects.xero_pnl SET report_month = \'2026-03-01 00:00:00 UTC\'');
    console.log('        WHERE DATE_TRUNC(\'month\', report_month AT TIME ZONE \'Australia/Melbourne\') = \'2026-03-01\'');
  }
}

console.log(line + '\n');

await client.end();
process.exit(failed > 0 ? 1 : 0);
