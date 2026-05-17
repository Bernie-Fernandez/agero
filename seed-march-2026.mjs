/**
 * Sprint 8 — March 2026 data seed (v3)
 * Uses array-of-arrays approach to handle complex merged-cell Excel sheets.
 * Run from repo root: node seed-march-2026.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const pg = require('pg');
const dotenv = require('dotenv');
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, 'apps', 'projects', '.env.local') });

const EXCEL_PATH = "C:\\Users\\bfern\\Agero Group Dropbox\\AG Team Folder\\7_Agero Accounts\\7.2 Mgmt Meeting\\Management Report - HA\\Management Report.xlsx";
const MARCH_2026 = '2026-03-01';
const FY_2026 = 2026;
const MONTHS_FY = ['jul','aug','sep','oct','nov','dec','jan','feb','mar','apr','may','jun'];

// Excel date serial numbers for FY2026 months (Jul-25 through Jun-26)
const FY2026_MONTH_SERIALS = {
  45839: 'jul', 45870: 'aug', 45901: 'sep', 45931: 'oct',
  45962: 'nov', 45992: 'dec', 46023: 'jan', 46054: 'feb',
  46082: 'mar', 46113: 'apr', 46143: 'may', 46174: 'jun',
};

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
function q(text, params) { return pool.query(text, params); }

function toN(v) {
  if (v === undefined || v === null || v === '') return 0;
  const n = parseFloat(String(v).replace(/[$,\s%]/g, ''));
  return isNaN(n) ? 0 : n;
}

function getSheetAoA(wb, name) {
  const ws = wb.Sheets[name];
  if (!ws) { console.log(`  WARNING: sheet "${name}" not found`); return []; }
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
}

function buildMonthColMap(headerRow) {
  const map = {};
  for (let i = 0; i < headerRow.length; i++) {
    const cell = headerRow[i];
    // Handle Excel date serial numbers
    if (typeof cell === 'number' && FY2026_MONTH_SERIALS[cell]) {
      map[FY2026_MONTH_SERIALS[cell]] = i;
      continue;
    }
    const s = String(cell ?? '').toLowerCase().trim();
    if (s.includes('jul')) map['jul'] = i;
    else if (s.includes('aug')) map['aug'] = i;
    else if (s.includes('sep')) map['sep'] = i;
    else if (s.includes('oct')) map['oct'] = i;
    else if (s.includes('nov')) map['nov'] = i;
    else if (s.includes('dec')) map['dec'] = i;
    else if (s.includes('jan')) map['jan'] = i;
    else if (s.includes('feb')) map['feb'] = i;
    else if (s.includes('mar') && !s.includes('margin')) map['mar'] = i;
    else if (s.includes('apr')) map['apr'] = i;
    else if (s.includes('may')) map['may'] = i;
    else if (s.includes('jun') && !s.includes('june 2025')) map['jun'] = i;
  }
  return map;
}

function findMonthHeaderRow(aoa, maxRows = 15) {
  for (let i = 0; i < Math.min(maxRows, aoa.length); i++) {
    const row = aoa[i] ?? [];
    // Count how many Excel FY2026 serials are in the row
    const serialCount = row.filter(v => typeof v === 'number' && FY2026_MONTH_SERIALS[v]).length;
    if (serialCount >= 6) return i;
    // Or text month names
    const s = row.map(v => String(v ?? '')).join('|').toLowerCase();
    if ((s.includes('jul') || s.includes('jul-25')) && s.includes('aug') && s.includes('sep')) return i;
  }
  return -1;
}

async function getOrgId() {
  const res = await q(`SELECT id FROM projects.organisations LIMIT 1`);
  if (res.rows.length === 0) throw new Error('No organisation found');
  return res.rows[0].id;
}

// ── Seed P&L ─────────────────────────────────────────────────────────────────
async function seedPnL(wb, orgId) {
  console.log('\n[1/6] Seeding XeroPnL from "Business - P&L"...');
  const aoa = getSheetAoA(wb, 'Business - P&L');
  if (!aoa.length) return;

  function findRowByLabel(rows, ...keywords) {
    for (const row of rows) {
      const label = String(row?.[0] ?? '').toLowerCase().trim();
      if (keywords.some(k => label.includes(k.toLowerCase()))) return row;
    }
    return null;
  }

  const COL = 1; // March actual is column index 1
  const revenueRow = findRowByLabel(aoa, 'revenue');
  const cosRow = findRowByLabel(aoa, 'cost of sales', 'direct cost');
  const dlRow = findRowByLabel(aoa, 'direct labour', 'direct lab');
  const gpRow = findRowByLabel(aoa, 'gross margin', 'gross profit');
  const ieRow = findRowByLabel(aoa, 'overhead expense', 'indirect expense');
  const ilRow = findRowByLabel(aoa, 'indirect labour', 'indirect lab');
  const mkRow = findRowByLabel(aoa, 'marketing');
  const npRow = findRowByLabel(aoa, 'net profit', 'net income');

  const revenue = revenueRow ? toN(revenueRow[COL]) : 0;
  const cos = cosRow ? toN(cosRow[COL]) : 0;
  const dl = dlRow ? toN(dlRow[COL]) : 0;
  const gp = gpRow ? toN(gpRow[COL]) : (revenue - cos - dl);
  const ie = ieRow ? toN(ieRow[COL]) : 0;
  const il = ilRow ? toN(ilRow[COL]) : 0;
  const mk = mkRow ? toN(mkRow[COL]) : 0;
  const np = npRow ? toN(npRow[COL]) : (gp - ie - il - mk);

  console.log(`  Revenue: ${revenue.toLocaleString()}, COS: ${cos.toLocaleString()}, DL: ${dl.toLocaleString()}`);
  console.log(`  GP: ${gp.toLocaleString()}, IE: ${ie.toLocaleString()}, IL: ${il.toLocaleString()}, Mkt: ${mk.toLocaleString()}, NP: ${np.toLocaleString()}`);

  await q(`
    INSERT INTO projects.xero_pnl (id, organisation_id, report_month, revenue, cost_of_sales, direct_labour, gross_profit, indirect_expenses, indirect_labour, marketing_expenses, net_profit_before_tax, created_at, updated_at)
    VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
    ON CONFLICT (organisation_id, report_month) DO UPDATE SET
      revenue=$3, cost_of_sales=$4, direct_labour=$5, gross_profit=$6,
      indirect_expenses=$7, indirect_labour=$8, marketing_expenses=$9,
      net_profit_before_tax=$10, updated_at=NOW()
  `, [orgId, MARCH_2026, revenue.toFixed(2), cos.toFixed(2), dl.toFixed(2), gp.toFixed(2), ie.toFixed(2), il.toFixed(2), mk.toFixed(2), np.toFixed(2)]);

  console.log(`  ✓ P&L seeded: Rev=${revenue.toLocaleString()}, GP=${gp.toLocaleString()}, NP=${np.toLocaleString()}`);
}

// ── Seed Bank Balances ────────────────────────────────────────────────────────
async function seedBankBalances(wb, orgId) {
  console.log('\n[2/6] Seeding XeroBankBalance from "Cash Flow"...');
  const aoa = getSheetAoA(wb, 'Cash Flow');
  if (!aoa.length) return;

  // Structure:
  // Row 0: [(A) Available Cash Balance, null, Mar-serial, Apr-serial, ...]  ← section header + date row
  // Row 1: [null, "Agero Group Pty Ltd (ANZ-0065)", balance, ...]
  // ...
  // Row 8: [null, "(1) Total Bank", total, ...]
  // Account name is in col 1, March balance is in col 2

  const headerRow = aoa[0] ?? [];
  // Col 2 is March (serial 46082 confirmed from debug output)
  let marColIdx = 2;
  for (let i = 0; i < headerRow.length; i++) {
    if (headerRow[i] === 46082) { marColIdx = i; break; }
  }
  console.log(`  March column index: ${marColIdx}`);

  let seeded = 0;
  for (let i = 1; i < aoa.length; i++) {
    const row = aoa[i];
    if (!row) continue;

    // Account name is in col 1 (col 0 is null or section header)
    const accountName = String(row[1] ?? '').trim();
    if (!accountName) continue;

    const balance = toN(row[marColIdx]);
    // Skip rows with zero balance and total/subtotal rows with "(n)" prefix that we don't need individually
    if (balance === 0) continue;

    // Skip derived totals for AR/AP (we only want bank/cash/borrowing accounts)
    const nameLower = accountName.toLowerCase();
    const isRelevant = !nameLower.includes('other current assets') &&
                       !nameLower.includes('accounts payable') &&
                       !nameLower.includes('accounts receivable') &&
                       !nameLower.includes('bank guarantee') &&
                       !nameLower.includes('(4)') && !nameLower.includes('(5)');

    if (!isRelevant) continue;

    console.log(`  Bank: "${accountName}" = ${balance.toLocaleString()}`);
    await q(`
      INSERT INTO projects.xero_bank_balances (id, organisation_id, report_month, account_name, balance, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (organisation_id, report_month, account_name) DO UPDATE SET balance=$4, updated_at=NOW()
    `, [orgId, MARCH_2026, accountName, balance.toFixed(2)]);
    seeded++;
  }

  console.log(`  ✓ ${seeded} bank balance rows seeded`);
}

// ── Seed Finance Projects ─────────────────────────────────────────────────────
async function seedProjects(wb, orgId) {
  console.log('\n[3/6] Seeding FinanceProject from "CAT - Financial"...');
  const aoa = getSheetAoA(wb, 'CAT - Financial');
  if (!aoa.length) return;

  // Find header row with "Job" and "Project Name" (col headers have \r\n)
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(10, aoa.length); i++) {
    const row = aoa[i];
    if (!row) continue;
    const cellStr = row.map(v => String(v ?? '')).join('|').toLowerCase();
    if (cellStr.includes('job') && (cellStr.includes('project') || cellStr.includes('contract'))) {
      headerRowIdx = i;
      break;
    }
  }

  const headerRow = aoa[headerRowIdx];

  function findCol(...keywords) {
    for (let i = 0; i < headerRow.length; i++) {
      const cell = String(headerRow[i] ?? '').toLowerCase().replace(/[\s\r\n]+/g, ' ').trim();
      if (keywords.some(k => cell.includes(k.toLowerCase()))) return i;
    }
    return -1;
  }

  const colStatus = findCol('status');
  const colJob = findCol('job');
  const colName = findCol('project name');
  const colCV = findCol('forecast contract', 'forecast\ncontract');
  const colFC = findCol('forecast final', 'final cost');
  const colRO = findCol('r&o');
  const colCT = findCol('claim total', 'claim\ntotal');
  const colCR = findCol('claim retention', 'claim \nretention');
  const colSC = findCol('sub claims', 'sub\nclaims');
  const colSR = findCol('sub retention', 'sub\nretention');
  const colCred = findCol('creditors');
  const colLabour = findCol('labour');
  const colWIP = findCol('wip');
  const colPC = findCol('pract', 'practical comp');

  console.log(`  Cols: status=${colStatus}, job=${colJob}, name=${colName}, cv=${colCV}, fc=${colFC}, ro=${colRO}`);

  let count = 0;
  for (let i = headerRowIdx + 1; i < aoa.length; i++) {
    const row = aoa[i];
    if (!row) continue;

    const jobNumber = String(row[colJob] ?? '').trim();
    if (!jobNumber || !jobNumber.match(/^\d/) || jobNumber.toLowerCase() === 'total') continue;

    const projectName = colName >= 0 ? String(row[colName] ?? '').trim() : jobNumber;
    if (!projectName) continue;

    const statusRaw = String(row[colStatus] ?? '').trim().toUpperCase();
    let status = 'AWARDED';
    if (statusRaw.includes('BACKLOG')) status = 'BACKLOG';
    else if (statusRaw.includes('DLP')) status = 'DLP';
    else if (statusRaw.includes('CLOSED')) status = 'CLOSED';

    const cv = colCV >= 0 ? toN(row[colCV]) : 0;
    const fc = colFC >= 0 ? toN(row[colFC]) : 0;
    const ro = colRO >= 0 ? toN(row[colRO]) : 0;
    const ct = colCT >= 0 ? toN(row[colCT]) : 0;
    const cr = colCR >= 0 ? toN(row[colCR]) : 0;
    const sc = colSC >= 0 ? toN(row[colSC]) : 0;
    const sr = colSR >= 0 ? toN(row[colSR]) : 0;
    const cred = colCred >= 0 ? toN(row[colCred]) : 0;
    const lab = colLabour >= 0 ? toN(row[colLabour]) : 0;

    const marginDollars = cv - fc + ro;
    const marginPct = cv !== 0 ? marginDollars / cv : 0;
    const totalCost = sc + cred + lab;
    const wip = colWIP >= 0 ? toN(row[colWIP]) : (ct - totalCost);

    let pcDate = null;
    if (colPC >= 0 && row[colPC] !== null && row[colPC] !== undefined) {
      const rawDate = row[colPC];
      if (typeof rawDate === 'number') {
        const d = XLSX.SSF.parse_date_code(rawDate);
        if (d) pcDate = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
      } else if (typeof rawDate === 'string' && rawDate.trim()) {
        pcDate = rawDate.trim();
      }
    }

    console.log(`  Job ${jobNumber}: "${projectName}" | ${status} | CV:${cv.toFixed(0)} WIP:${wip.toFixed(0)}`);

    await q(`
      INSERT INTO projects.finance_projects (
        id, organisation_id, report_month, job_number, project_name, status,
        practical_completion_date,
        forecast_contract_value, forecast_final_costs, risk_and_opportunity,
        forecast_margin_dollars, forecast_margin_percent,
        claim_total, claim_retention, sub_claims, sub_retention,
        creditors, labour, total_cost, wip,
        data_verified, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18, $19,
        false, NOW(), NOW()
      )
      ON CONFLICT DO NOTHING
    `, [
      orgId, MARCH_2026, jobNumber, projectName, status, pcDate,
      cv.toFixed(2), fc.toFixed(2), ro.toFixed(2), marginDollars.toFixed(2), marginPct.toFixed(6),
      ct.toFixed(2), cr.toFixed(2), sc.toFixed(2), sr.toFixed(2),
      cred.toFixed(2), lab.toFixed(2), totalCost.toFixed(2), wip.toFixed(2)
    ]);
    count++;
  }

  console.log(`  ✓ ${count} projects seeded`);
}

// ── Seed Budget ───────────────────────────────────────────────────────────────
async function seedBudget(wb, orgId) {
  console.log('\n[4/6] Seeding AnnualBudget from "(A) Budget FY 2025-26"...');

  const sheetName = wb.SheetNames.find(n => n.includes('(A) Budget')) || wb.SheetNames.find(n => n.toLowerCase().includes('budget'));
  if (!sheetName) { console.log('  No budget sheet found'); return; }
  console.log(`  Using sheet: "${sheetName}"`);

  const aoa = getSheetAoA(wb, sheetName);

  const headerRowIdx = findMonthHeaderRow(aoa);
  if (headerRowIdx < 0) {
    console.log('  Could not find month header row in budget sheet');
    return;
  }

  const headerRow = aoa[headerRowIdx];
  const monthColMap = buildMonthColMap(headerRow);
  console.log(`  Header row ${headerRowIdx}, month cols:`, monthColMap);

  if (Object.keys(monthColMap).length < 6) {
    console.log('  Insufficient month columns found:', Object.keys(monthColMap));
    return;
  }

  let currentCategory = 'REVENUE';
  let order = 0;
  let count = 0;

  for (let i = headerRowIdx + 1; i < aoa.length; i++) {
    const row = aoa[i];
    if (!row) continue;
    const label = String(row[0] ?? '').trim();
    if (!label) continue;

    const labelL = label.toLowerCase();

    // Detect category changes from section headers
    if (labelL.includes('trading income') || (labelL.includes('revenue') && !labelL.includes('total'))) currentCategory = 'REVENUE';
    else if (labelL.includes('cost of sales') || (labelL.includes('direct cost') && !labelL.includes('labour'))) currentCategory = 'COST_OF_SALES';
    else if (labelL.includes('direct labour') && !labelL.includes('indirect')) currentCategory = 'DIRECT_LABOUR';
    else if (labelL.includes('indirect labour')) currentCategory = 'INDIRECT_LABOUR';
    else if (labelL.includes('marketing')) currentCategory = 'MARKETING';
    else if (labelL.includes('overhead') || labelL.includes('indirect expense')) currentCategory = 'INDIRECT_EXPENSES';

    // Skip section headers, totals, and derived rows
    if (labelL.includes('total') || labelL.includes('gross profit') || labelL.includes('gross margin') ||
        labelL.includes('net profit') || labelL.includes('ebit') || labelL.endsWith('%') ||
        labelL === 'trading income' || labelL === 'direct labour' || labelL === 'indirect labour' ||
        labelL === 'overhead' || labelL === 'cost of sales' || labelL === 'marketing') continue;

    const monthData = {};
    let hasData = false;
    for (const m of MONTHS_FY) {
      const colIdx = monthColMap[m];
      const val = colIdx !== undefined ? toN(row[colIdx]) : 0;
      monthData[m] = val.toFixed(2);
      if (val !== 0) hasData = true;
    }
    if (!hasData) continue;

    const total = MONTHS_FY.reduce((s, m) => s + parseFloat(monthData[m]), 0);
    console.log(`  Budget: [${currentCategory}] "${label}" → ${total.toLocaleString()}`);

    await q(`
      INSERT INTO projects.annual_budgets (
        id, organisation_id, financial_year, category, line_item,
        jul, aug, sep, oct, nov, dec, jan, feb, mar, apr, may, jun,
        total, display_order, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4,
        $5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
        $17, $18, NOW(), NOW()
      )
      ON CONFLICT (organisation_id, financial_year, line_item) DO UPDATE SET
        category      = EXCLUDED.category,
        jul           = EXCLUDED.jul,
        aug           = EXCLUDED.aug,
        sep           = EXCLUDED.sep,
        oct           = EXCLUDED.oct,
        nov           = EXCLUDED.nov,
        dec           = EXCLUDED.dec,
        jan           = EXCLUDED.jan,
        feb           = EXCLUDED.feb,
        mar           = EXCLUDED.mar,
        apr           = EXCLUDED.apr,
        may           = EXCLUDED.may,
        jun           = EXCLUDED.jun,
        total         = EXCLUDED.total,
        display_order = EXCLUDED.display_order,
        updated_at    = NOW()
    `, [
      orgId, FY_2026, currentCategory, label,
      monthData.jul, monthData.aug, monthData.sep, monthData.oct, monthData.nov, monthData.dec,
      monthData.jan, monthData.feb, monthData.mar, monthData.apr, monthData.may, monthData.jun,
      total.toFixed(2), order++
    ]);
    count++;
  }

  console.log(`  ✓ ${count} budget rows seeded`);
}

// ── Seed Secured Forecast ─────────────────────────────────────────────────────
async function seedSecuredForecast(wb, orgId) {
  console.log('\n[5/6] Seeding SecuredForecast from "Secured Forecast"...');
  const aoa = getSheetAoA(wb, 'Secured Forecast');
  if (!aoa.length) return;

  // Structure:
  // Row 0: ["Month", null, null, <Sep-25 serial>, ...]  — top-level section labels
  // Row 1: ["Status","Job","Project Name","Contract Value","Contract Cost","Contract Margin","Margin %",
  //          "To be Invoiced","Invoiced Till Date", <Jul-25>, <Aug-25>, ..., <Jun-26>, "Next Year", ...]
  // Row 2+: data

  // Row 1 has the month headers as Excel serials
  const headerRowIdx = 1;
  const headerRow = aoa[headerRowIdx] ?? [];
  const monthColMap = buildMonthColMap(headerRow);
  console.log(`  Month col map (from row ${headerRowIdx}):`, monthColMap);

  if (Object.keys(monthColMap).length < 6) {
    // Also try row 0
    const row0MonthMap = buildMonthColMap(aoa[0] ?? []);
    if (Object.keys(row0MonthMap).length >= 6) {
      Object.assign(monthColMap, row0MonthMap);
      console.log(`  Month col map supplemented from row 0:`, monthColMap);
    }
  }

  if (Object.keys(monthColMap).length < 3) {
    console.log('  No month headers found in Secured Forecast. Rows:');
    for (let i = 0; i < Math.min(5, aoa.length); i++) {
      if (aoa[i]) console.log(`  Row ${i}: ${JSON.stringify(aoa[i])}`);
    }
    return;
  }

  let count = 0;
  let currentStatus = 'AWARDED';
  const dataStartRow = 2;

  for (let i = dataStartRow; i < aoa.length; i++) {
    const row = aoa[i];
    if (!row) continue;

    const col0 = String(row[0] ?? '').trim();
    const col1 = String(row[1] ?? '').trim();
    const col2 = String(row[2] ?? '').trim();

    if (col0.toLowerCase().includes('awarded') && !col0.toLowerCase().includes('total')) currentStatus = 'AWARDED';
    else if (col0.toLowerCase().includes('backlog') && !col0.toLowerCase().includes('total')) currentStatus = 'BACKLOG';

    const jobNumber = col1.replace(/^0+/, '');
    if (!jobNumber || !jobNumber.match(/^\d{3,4}$/) ||
        col0.toLowerCase().includes('total') || col0.toLowerCase().includes('grand')) continue;

    const projectName = col2 || jobNumber;
    const contractValue = toN(row[3]);
    const contractCost = toN(row[4]);
    let marginPct = toN(row[6]);
    if (marginPct > 1) marginPct = marginPct / 100;

    const monthData = {};
    for (const m of MONTHS_FY) {
      const colIdx = monthColMap[m];
      monthData[m] = (colIdx !== undefined ? toN(row[colIdx]) : 0).toFixed(2);
    }

    const total = MONTHS_FY.reduce((s, m) => s + parseFloat(monthData[m]), 0);
    console.log(`  SF: Job ${jobNumber}: "${projectName}" | ${currentStatus} | Margin: ${(marginPct*100).toFixed(1)}% | Total: ${total.toFixed(0)}`);

    await q(`
      INSERT INTO projects.secured_forecasts (
        id, organisation_id, financial_year, job_number, project_name, status, margin_percent,
        jul, aug, sep, oct, nov, dec, jan, feb, mar, apr, may, jun,
        next_year_wip, total, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6,
        $7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
        '0.00', $19, NOW(), NOW()
      )
      ON CONFLICT (organisation_id, financial_year, job_number) DO UPDATE SET
        project_name=$4, status=$5, margin_percent=$6,
        jul=$7, aug=$8, sep=$9, oct=$10, nov=$11, dec=$12,
        jan=$13, feb=$14, mar=$15, apr=$16, may=$17, jun=$18,
        total=$19, updated_at=NOW()
    `, [
      orgId, FY_2026, jobNumber, projectName, currentStatus, marginPct.toFixed(6),
      monthData.jul, monthData.aug, monthData.sep, monthData.oct, monthData.nov, monthData.dec,
      monthData.jan, monthData.feb, monthData.mar, monthData.apr, monthData.may, monthData.jun,
      total.toFixed(2)
    ]);
    count++;
  }

  console.log(`  ✓ ${count} secured forecast rows seeded`);
}

// ── Seed BU Manual Fields ─────────────────────────────────────────────────────
async function seedBUManualFields(orgId) {
  console.log('\n[5b/6] Seeding XeroPnL Business Unit manually-entered fields for March 2026...');
  await q(`
    INSERT INTO projects.xero_pnl (id, organisation_id, report_month,
      awarded_gross_profit_ytd, awarded_revenue_ytd,
      backlog_gross_profit_ytd, backlog_revenue_ytd,
      net_project_cash_flow,
      awarded_ytd_budget_margin, backlog_ytd_budget_margin,
      created_at, updated_at
    ) VALUES (
      gen_random_uuid(), $1, $2,
      668338.08, 2468563.96, 598262.99, 1301223.14, 1128241.58,
      500009.46, 248531.54,
      NOW(), NOW()
    )
    ON CONFLICT (organisation_id, report_month) DO UPDATE SET
      awarded_gross_profit_ytd = 668338.08,
      awarded_revenue_ytd = 2468563.96,
      backlog_gross_profit_ytd = 598262.99,
      backlog_revenue_ytd = 1301223.14,
      net_project_cash_flow = 1128241.58,
      awarded_ytd_budget_margin = 500009.46,
      backlog_ytd_budget_margin = 248531.54,
      updated_at = NOW()
  `, [orgId, MARCH_2026]);
  console.log('  ✓ BU manual fields seeded: awardedYtdBudget=$500,009.46, backlogYtdBudget=$248,531.54');
}

// ── Seed AnnualBudget Margin Lines ────────────────────────────────────────────
async function seedBudgetMarginLines(orgId) {
  console.log('\n[5c/6] Seeding AnnualBudget margin budget lines for Awarded/Backlog...');
  for (const [lineItem, total, displayOrder] of [
    ['Awarded Projects Margin Budget', 1703244.46, 900],
    ['Backlog Projects Margin Budget', 248531.54, 901],
  ]) {
    const existing = await q(
      `SELECT id FROM projects.annual_budgets WHERE organisation_id=$1 AND financial_year=2026 AND line_item=$2`,
      [orgId, lineItem]
    );
    if (existing.rows.length > 0) {
      await q(
        `UPDATE projects.annual_budgets SET total=$1, updated_at=NOW() WHERE id=$2`,
        [total.toFixed(2), existing.rows[0].id]
      );
      console.log(`  Updated "${lineItem}" → ${total.toLocaleString()}`);
    } else {
      await q(
        `INSERT INTO projects.annual_budgets (id, organisation_id, financial_year, category, line_item, total, display_order, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, 2026, 'GROSS_MARGIN', $2, $3, $4, NOW(), NOW())`,
        [orgId, lineItem, total.toFixed(2), displayOrder]
      );
      console.log(`  Inserted "${lineItem}" → ${total.toLocaleString()}`);
    }
  }
  console.log('  ✓ AnnualBudget margin budget lines seeded: Awarded=$1,703,244.46, Backlog=$248,531.54');
}

// ── Seed MonthEndStatus ───────────────────────────────────────────────────────
async function seedMonthEndStatus(orgId) {
  console.log('\n[6/6] Seeding MonthEndStatus for March 2026 as SYNCED...');
  await q(`
    INSERT INTO projects.month_end_statuses (
      id, organisation_id, report_month, status, notes, xero_synced_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), $1, $2, 'SYNCED',
      'Seeded from March 2026 Excel — awaiting live Xero connection.',
      NOW(), NOW(), NOW()
    )
    ON CONFLICT (organisation_id, report_month) DO UPDATE SET
      status='SYNCED',
      notes='Seeded from March 2026 Excel — awaiting live Xero connection.',
      xero_synced_at=NOW(), updated_at=NOW()
  `, [orgId, MARCH_2026]);
  console.log('  ✓ MonthEndStatus set to SYNCED');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Reading Excel:', EXCEL_PATH);
  const wb = XLSX.readFile(EXCEL_PATH);
  console.log('Sheets:', wb.SheetNames.join(', '));

  const orgId = await getOrgId();
  console.log('Organisation ID:', orgId);

  await seedPnL(wb, orgId);
  await seedBankBalances(wb, orgId);
  await seedProjects(wb, orgId);
  await seedBudget(wb, orgId);
  await seedSecuredForecast(wb, orgId);
  await seedBUManualFields(orgId);
  await seedBudgetMarginLines(orgId);
  await seedMonthEndStatus(orgId);

  console.log('\n✅ Sprint 8–9 seed complete.');
  await pool.end();
}

main().catch(async (err) => {
  console.error('SEED ERROR:', err.message);
  console.error(err.stack);
  await pool.end();
  process.exit(1);
});
