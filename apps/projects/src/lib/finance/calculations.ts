import { prisma } from '@/lib/prisma';

// ─── Helper types ─────────────────────────────────────────────────────────────

type FinanceProjectRow = {
  id: string;
  jobNumber: string;
  projectName: string;
  status: string;
  forecastContractValue: unknown;
  forecastFinalCosts: unknown;
  forecastMarginDollars: unknown;
  forecastMarginPercent: unknown;
  targetExitMarginPercent: unknown;
  claimTotal: unknown;
  claimRetention: unknown;
  subClaims: unknown;
  subRetention: unknown;
  creditors: unknown;
  labour: unknown;
  totalCost: unknown;
  wip: unknown;
  costToComplete: unknown;
};

function n(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const x = parseFloat(String(v));
  return isNaN(x) ? 0 : x;
}

// ─── Financial year helpers ───────────────────────────────────────────────────

export function getFinancialYear(date: Date): number {
  const month = date.getUTCMonth() + 1;
  // Convention: FY2026 = Jul 2025 – Jun 2026 (year the FY ends)
  return month >= 7 ? date.getUTCFullYear() + 1 : date.getUTCFullYear();
}

export function getMonthsYtd(reportMonth: Date): Date[] {
  const fy = getFinancialYear(reportMonth);
  const months: Date[] = [];
  // FY runs Jul(fy-1)–Jun(fy), e.g. FY2026 = Jul 2025 – Jun 2026
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

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

// ─── WIP calculation for a single project ────────────────────────────────────

export function calcWIP(p: FinanceProjectRow, targetExitMarginDecimal: number) {
  const cv = n(p.forecastContractValue);
  const ffc = n(p.forecastFinalCosts);
  const costsToDate = n(p.totalCost); // sub_claims + creditors + labour
  const ctcEntered = p.costToComplete !== null && p.costToComplete !== undefined;
  const costToComplete = ctcEntered
    ? n(p.costToComplete)
    : Math.max(0, ffc - costsToDate); // fallback estimate

  const estimatedTotalCost = costsToDate + costToComplete;
  const pctComplete = estimatedTotalCost > 0 ? Math.min(1, costsToDate / estimatedTotalCost) : 0;
  const earnedRevenue = cv * pctComplete;
  const billedToDate = n(p.claimTotal);
  const overbilledUnderbilled = earnedRevenue - billedToDate;
  const estimatedGrossProfit = cv - estimatedTotalCost;
  const estimatedGpPct = cv > 0 ? estimatedGrossProfit / cv : 0;

  // Traffic light
  let flag: 'GREEN' | 'AMBER' | 'RED' | 'NONE' = 'NONE';
  let flagReason: string | null = null;

  if (!ctcEntered) {
    flag = 'NONE'; // grey ESTIMATED — handled in UI
  } else if (estimatedGpPct < targetExitMarginDecimal - 0.05) {
    flag = 'RED';
    flagReason = 'GP% below target by >5%';
    if (costsToDate > estimatedTotalCost * 1.1) flagReason = 'Cost overrun >10% of budget';
    if (overbilledUnderbilled < 0 && Math.abs(overbilledUnderbilled) > cv * 0.15) flagReason = 'Overbilled >15% of contract';
  } else if (estimatedGpPct >= targetExitMarginDecimal - 0.05 && estimatedGpPct < targetExitMarginDecimal) {
    flag = 'AMBER';
    flagReason = 'Margin declining — watch';
  } else if (estimatedGpPct >= targetExitMarginDecimal && Math.abs(overbilledUnderbilled) <= cv * 0.1) {
    flag = 'GREEN';
  } else {
    flag = 'AMBER';
    flagReason = 'Overbilled/underbilled outside ±10%';
  }

  return {
    contractValue: cv,
    estimatedTotalCost,
    costsToDate,
    costToComplete,
    pctComplete,
    earnedRevenue,
    billedToDate,
    overbilledUnderbilled,
    estimatedGrossProfit,
    estimatedGpPct,
    flag,
    flagReason,
    costToCompleteEstimated: !ctcEntered,
  };
}

// ─── Business Unit Summary ────────────────────────────────────────────────────

const SF_MONTHS = ['jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun'] as const;
type SFMonthKey = typeof SF_MONTHS[number];

// SecuredForecast monthly columns store margin dollars (GP) directly — do NOT multiply by marginPercent
function sfMarginForMonths(forecasts: { [k: string]: unknown }[], status: string, months: SFMonthKey[]): number {
  return forecasts
    .filter((sf) => sf.status === status)
    .reduce((sum, sf) => sum + months.reduce((s, m) => s + n(sf[m]), 0), 0);
}

function ytdMonthKeys(ytdDates: Date[]): SFMonthKey[] {
  return ytdDates.map((d) => SF_MONTHS[d.getUTCMonth() >= 6 ? d.getUTCMonth() - 6 : d.getUTCMonth() + 6] as SFMonthKey);
}

export async function calcBusinessUnitSummary(organisationId: string, reportMonth: Date) {
  const fy = getFinancialYear(reportMonth);
  const ytdDates = getMonthsYtd(reportMonth);
  const ytdKeys = ytdMonthKeys(ytdDates);

  const [pnl, budgetRows, securedForecasts] = await Promise.all([
    prisma.xeroPnL.findFirst({ where: { organisationId, reportMonth } }),
    prisma.annualBudget.findMany({ where: { organisationId, financialYear: fy } }),
    prisma.securedForecast.findMany({ where: { organisationId, financialYear: fy } }),
  ]);

  // YTD actuals — from manually-entered XeroPnL fields
  const awardedGpYtd = pnl?.awardedGrossProfitYtd ? n(pnl.awardedGrossProfitYtd) : null;
  const awardedRevYtd = pnl?.awardedRevenueYtd ? n(pnl.awardedRevenueYtd) : null;
  const backlogGpYtd = pnl?.backlogGrossProfitYtd ? n(pnl.backlogGrossProfitYtd) : null;
  const backlogRevYtd = pnl?.backlogRevenueYtd ? n(pnl.backlogRevenueYtd) : null;
  const netCashFlow = pnl?.netProjectCashFlow ? n(pnl.netProjectCashFlow) : null;

  // YTD Budget — from manually-entered XeroPnL fields (seeded from (B) Budget sheet)
  const awardedYtdBudget = pnl?.awardedYtdBudgetMargin != null ? n(pnl.awardedYtdBudgetMargin) : 0;
  const backlogYtdBudget = pnl?.backlogYtdBudgetMargin != null ? n(pnl.backlogYtdBudgetMargin) : 0;

  // FY Forecast = YTD actual GP + remaining months of SecuredForecast × marginPercent
  const remainingKeys = SF_MONTHS.filter((m) => !ytdKeys.includes(m));
  const awardedFyForecast = (awardedGpYtd ?? 0) + sfMarginForMonths(securedForecasts, 'AWARDED', remainingKeys);
  const backlogFyForecast = (backlogGpYtd ?? 0) + sfMarginForMonths(securedForecasts, 'BACKLOG', remainingKeys);

  // FY Budget — from AnnualBudget line items keyed by 'awarded' / 'backlog'
  const awardedBudgetRow = budgetRows.find((r) => r.lineItem.toLowerCase().includes('awarded'));
  const backlogBudgetRow = budgetRows.find((r) => r.lineItem.toLowerCase().includes('backlog'));
  const awardedFyBudget = awardedBudgetRow ? n(awardedBudgetRow.total) : null;
  const backlogFyBudget = backlogBudgetRow ? n(backlogBudgetRow.total) : null;

  // Derived figures for Awarded
  const awardedYtdVarD = awardedGpYtd !== null ? awardedGpYtd - awardedYtdBudget : null;
  const awardedYtdVarPct = awardedYtdBudget !== 0 && awardedYtdVarD !== null ? awardedYtdVarD / awardedYtdBudget : null;
  const awardedYtdMarginPct = awardedRevYtd !== null && awardedRevYtd !== 0 && awardedGpYtd !== null ? awardedGpYtd / awardedRevYtd : null;
  const awardedFyVarD = awardedFyBudget !== null ? awardedFyForecast - awardedFyBudget : null;
  const awardedFyVarPct = awardedFyBudget !== null && awardedFyBudget !== 0 && awardedFyVarD !== null ? awardedFyVarD / awardedFyBudget : null;

  // Derived figures for Backlog
  const backlogYtdVarD = backlogGpYtd !== null ? backlogGpYtd - backlogYtdBudget : null;
  const backlogYtdVarPct = backlogYtdBudget !== 0 && backlogYtdVarD !== null ? backlogYtdVarD / backlogYtdBudget : null;
  const backlogYtdMarginPct = backlogRevYtd !== null && backlogRevYtd !== 0 && backlogGpYtd !== null ? backlogGpYtd / backlogRevYtd : null;
  const backlogFyVarD = backlogFyBudget !== null ? backlogFyForecast - backlogFyBudget : null;
  const backlogFyVarPct = backlogFyBudget !== null && backlogFyBudget !== 0 && backlogFyVarD !== null ? backlogFyVarD / backlogFyBudget : null;

  // Net Cash Flow vs Gross Margin
  const totalGpYtd = (awardedGpYtd ?? 0) + (backlogGpYtd ?? 0);
  const netCashVsGrossMargin = netCashFlow !== null ? netCashFlow - totalGpYtd : null;

  return {
    awarded: {
      ytdActualMargin: awardedGpYtd,
      ytdActualRevenue: awardedRevYtd,
      ytdBudgetMargin: awardedYtdBudget,
      ytdVarianceDollars: awardedYtdVarD,
      ytdVariancePct: awardedYtdVarPct,
      ytdMarginPct: awardedYtdMarginPct,
      fyForecastMargin: awardedFyForecast,
      fyBudgetMargin: awardedFyBudget,
      fyVarianceDollars: awardedFyVarD,
      fyVariancePct: awardedFyVarPct,
    },
    backlog: {
      ytdActualMargin: backlogGpYtd,
      ytdActualRevenue: backlogRevYtd,
      ytdBudgetMargin: backlogYtdBudget,
      ytdVarianceDollars: backlogYtdVarD,
      ytdVariancePct: backlogYtdVarPct,
      ytdMarginPct: backlogYtdMarginPct,
      fyForecastMargin: backlogFyForecast,
      fyBudgetMargin: backlogFyBudget,
      fyVarianceDollars: backlogFyVarD,
      fyVariancePct: backlogFyVarPct,
    },
    netProjectCashFlow: netCashFlow,
    netCashVsGrossMargin,
    reportMonth: reportMonth.toISOString(),
  };
}

// ─── Budget line groupings (exact names from annual_budgets table) ────────────

const BUDGET_REVENUE_LINES = ['BF Sales'];
const BUDGET_COS_LINES = [
  'Proj. Costs - Building Surveyors', 'Proj. Costs - Client Specific Gifts',
  'Proj. Costs - Consultants/Engineers', 'Proj. Costs - Contractors and Suppliers',
  'Proj. Costs - Design/Arch. Costs', 'Proj. Costs - Management Costs',
  'Proj. Costs - Parking', 'Proj. Costs - Prelim and General Other',
  'Proj. Costs - Referral Fees', 'Proj. Costs - Specific Site Allowances/OHS/Site Equipment',
  'Proj. Costs - Travel National', 'Proj Other Costs Fuel / Tolls',
];
const BUDGET_DL_LINES = ['Proj. Wages and Salaries', 'Proj. Staff Superannuation', 'Proj. Staff - Car Allowance'];
const BUDGET_IL_LINES = ['Admin - Wages and Salaries', 'Admin Staff - Superannuation', 'Directors - Wages, Salary', 'Directors - Superannuation', 'Directors - EO Costs'];
const BUDGET_MKT_LINES = ['Marketing - Advertising', 'Marketing - Entertainment', 'Marketing - Events', 'Marketing - General', 'Marketing - Graphics/Website Design/Co Collateral'];
const BUDGET_SKIP_SET = new Set([
  ...BUDGET_REVENUE_LINES, ...BUDGET_COS_LINES, ...BUDGET_DL_LINES,
  ...BUDGET_IL_LINES, ...BUDGET_MKT_LINES,
  'Awarded Projects Margin Budget', 'Backlog Projects Margin Budget',
]);

function getRemainingFYMonths(reportMonth: Date): Date[] {
  const fy = getFinancialYear(reportMonth);
  const allFYMonths: Date[] = [];
  for (let m = 7; m <= 12; m++) allFYMonths.push(new Date(Date.UTC(fy - 1, m - 1, 1)));
  for (let m = 1; m <= 6; m++) allFYMonths.push(new Date(Date.UTC(fy, m - 1, 1)));
  return allFYMonths.filter((m) => m > reportMonth);
}

function getMonthBudgetKey(d: Date): string {
  const names = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  return names[d.getUTCMonth()];
}

// ─── Consolidated P&L ────────────────────────────────────────────────────────

export async function calcConsolidatedPnL(organisationId: string, reportMonth: Date) {
  const fy = getFinancialYear(reportMonth);
  const ytdMonths = getMonthsYtd(reportMonth);
  const remainingMonths = getRemainingFYMonths(reportMonth);
  const reportMonthKey = getMonthBudgetKey(reportMonth);

  const [pnlRecords, budgetRows, securedForecasts] = await Promise.all([
    prisma.xeroPnL.findMany({ where: { organisationId } }),
    prisma.annualBudget.findMany({ where: { organisationId, financialYear: fy } }),
    prisma.securedForecast.findMany({ where: { organisationId, financialYear: fy } }),
  ]);

  const thisMonthPnl = pnlRecords.find((p) => monthKey(p.reportMonth) === monthKey(reportMonth));

  // YTD actuals from XeroPnL (summed across all YTD months)
  type PnLRow = typeof pnlRecords[number];
  const sumYtd = (field: keyof PnLRow) =>
    ytdMonths.reduce((s, m) => {
      const rec = pnlRecords.find((p) => monthKey(p.reportMonth) === monthKey(m));
      return s + (rec ? n(rec[field]) : 0);
    }, 0);

  const ytdRevenue = sumYtd('revenue');
  const ytdCoS = sumYtd('costOfSales');
  const ytdDL = sumYtd('directLabour');
  const ytdGP = sumYtd('grossProfit');
  const ytdIndirectExp = sumYtd('indirectExpenses');
  const ytdIndirectLab = sumYtd('indirectLabour');
  const ytdMarketing = sumYtd('marketingExpenses');
  const ytdNP = sumYtd('netProfitBeforeTax');

  // Budget helpers using exact line item names
  type BudRow = typeof budgetRows[number];
  const bSum = (lines: string[], key: string) =>
    budgetRows.filter((r) => lines.includes(r.lineItem))
      .reduce((s, r) => s + n((r as unknown as Record<string, unknown>)[key]), 0);
  const bIndExp = (key: string) =>
    budgetRows.filter((r) => !BUDGET_SKIP_SET.has(r.lineItem))
      .reduce((s, r) => s + n((r as unknown as Record<string, unknown>)[key]), 0);
  const bSumFY = (lines: string[]) =>
    budgetRows.filter((r) => lines.includes(r.lineItem)).reduce((s, r) => s + n(r.total), 0);
  const bIndExpFY = () =>
    budgetRows.filter((r) => !BUDGET_SKIP_SET.has(r.lineItem)).reduce((s, r) => s + n(r.total), 0);
  const bSumYtd = (lines: string[]) =>
    ytdMonths.reduce((s, m) => s + bSum(lines, getMonthBudgetKey(m)), 0);
  const bIndExpYtd = () =>
    ytdMonths.reduce((s, m) => s + bIndExp(getMonthBudgetKey(m)), 0);

  // This-month budget
  const tmBudRev = bSum(BUDGET_REVENUE_LINES, reportMonthKey);
  const tmBudCoS = bSum(BUDGET_COS_LINES, reportMonthKey);
  const tmBudDL  = bSum(BUDGET_DL_LINES, reportMonthKey);
  const tmBudGP  = tmBudRev - tmBudCoS - tmBudDL;
  const tmBudIE  = bIndExp(reportMonthKey);
  const tmBudIL  = bSum(BUDGET_IL_LINES, reportMonthKey);
  const tmBudMkt = bSum(BUDGET_MKT_LINES, reportMonthKey);
  const tmBudNP  = tmBudGP - tmBudIE - tmBudIL - tmBudMkt;

  // YTD budget
  const ytdBudRev = bSumYtd(BUDGET_REVENUE_LINES);
  const ytdBudCoS = bSumYtd(BUDGET_COS_LINES);
  const ytdBudDL  = bSumYtd(BUDGET_DL_LINES);
  const ytdBudGP  = ytdBudRev - ytdBudCoS - ytdBudDL;
  const ytdBudIE  = bIndExpYtd();
  const ytdBudIL  = bSumYtd(BUDGET_IL_LINES);
  const ytdBudMkt = bSumYtd(BUDGET_MKT_LINES);
  const ytdBudNP  = ytdBudGP - ytdBudIE - ytdBudIL - ytdBudMkt;

  // Full-year budget (use .total column)
  const fyBudRev = bSumFY(BUDGET_REVENUE_LINES);
  const fyBudCoS = bSumFY(BUDGET_COS_LINES);
  const fyBudDL  = bSumFY(BUDGET_DL_LINES);
  const fyBudGP  = fyBudRev - fyBudCoS - fyBudDL;
  const fyBudIE  = bIndExpFY();
  const fyBudIL  = bSumFY(BUDGET_IL_LINES);
  const fyBudMkt = bSumFY(BUDGET_MKT_LINES);
  const fyBudNP  = fyBudGP - fyBudIE - fyBudIL - fyBudMkt;

  // Full-year forecast: revenue = YTD + secured forecast remaining; costs = run rate
  const ytdMonthCount = ytdMonths.length;
  const remMonthCount = remainingMonths.length;
  const runRate = (ytd: number) =>
    ytdMonthCount > 0 ? ytd + (ytd / ytdMonthCount) * remMonthCount : ytd;

  const sfRevRemaining = securedForecasts.reduce(
    (s, sf) => s + remainingMonths.reduce(
      (ms, m) => ms + n((sf as unknown as Record<string, unknown>)[getMonthBudgetKey(m)]), 0
    ), 0
  );
  const fyFcRev = ytdRevenue + sfRevRemaining;
  const fyFcCoS = runRate(ytdCoS);
  const fyFcDL  = runRate(ytdDL);
  const fyFcGP  = fyFcRev - fyFcCoS - fyFcDL;
  const fyFcIE  = runRate(ytdIndirectExp);
  const fyFcIL  = runRate(ytdIndirectLab);
  const fyFcMkt = runRate(ytdMarketing);
  const fyFcNP  = fyFcGP - fyFcIE - fyFcIL - fyFcMkt;

  // This-month actuals
  const tm = {
    revenue:           thisMonthPnl ? n(thisMonthPnl.revenue) : 0,
    costOfSales:       thisMonthPnl ? n(thisMonthPnl.costOfSales) : 0,
    directLabour:      thisMonthPnl ? n(thisMonthPnl.directLabour) : 0,
    grossProfit:       thisMonthPnl ? n(thisMonthPnl.grossProfit) : 0,
    grossMarginPct:    thisMonthPnl && n(thisMonthPnl.revenue) > 0 ? n(thisMonthPnl.grossProfit) / n(thisMonthPnl.revenue) : 0,
    indirectExpenses:  thisMonthPnl ? n(thisMonthPnl.indirectExpenses) : 0,
    indirectLabour:    thisMonthPnl ? n(thisMonthPnl.indirectLabour) : 0,
    marketingExpenses: thisMonthPnl ? n(thisMonthPnl.marketingExpenses) : 0,
    netProfitBeforeTax: thisMonthPnl ? n(thisMonthPnl.netProfitBeforeTax) : 0,
    netProfitRate:     thisMonthPnl && n(thisMonthPnl.revenue) > 0 ? n(thisMonthPnl.netProfitBeforeTax) / n(thisMonthPnl.revenue) : 0,
  };

  return {
    thisMonth: {
      actual: tm,
      budget: { revenue: tmBudRev, costOfSales: tmBudCoS, directLabour: tmBudDL, grossProfit: tmBudGP, indirectExpenses: tmBudIE, indirectLabour: tmBudIL, marketingExpenses: tmBudMkt, netProfitBeforeTax: tmBudNP },
      variance: { revenue: tm.revenue - tmBudRev, costOfSales: tm.costOfSales - tmBudCoS, directLabour: tm.directLabour - tmBudDL, grossProfit: tm.grossProfit - tmBudGP, indirectExpenses: tm.indirectExpenses - tmBudIE, indirectLabour: tm.indirectLabour - tmBudIL, marketingExpenses: tm.marketingExpenses - tmBudMkt, netProfitBeforeTax: tm.netProfitBeforeTax - tmBudNP },
    },
    ytd: {
      actual: { revenue: ytdRevenue, costOfSales: ytdCoS, directLabour: ytdDL, grossProfit: ytdGP, grossMarginPct: ytdRevenue > 0 ? ytdGP / ytdRevenue : 0, indirectExpenses: ytdIndirectExp, indirectLabour: ytdIndirectLab, marketingExpenses: ytdMarketing, netProfitBeforeTax: ytdNP, netProfitRate: ytdRevenue > 0 ? ytdNP / ytdRevenue : 0 },
      budget: { revenue: ytdBudRev, costOfSales: ytdBudCoS, directLabour: ytdBudDL, grossProfit: ytdBudGP, indirectExpenses: ytdBudIE, indirectLabour: ytdBudIL, marketingExpenses: ytdBudMkt, netProfitBeforeTax: ytdBudNP },
      variance: { revenue: ytdRevenue - ytdBudRev, costOfSales: ytdCoS - ytdBudCoS, directLabour: ytdDL - ytdBudDL, grossProfit: ytdGP - ytdBudGP, indirectExpenses: ytdIndirectExp - ytdBudIE, indirectLabour: ytdIndirectLab - ytdBudIL, marketingExpenses: ytdMarketing - ytdBudMkt, netProfitBeforeTax: ytdNP - ytdBudNP },
    },
    fullYear: {
      budget:   { revenue: fyBudRev, costOfSales: fyBudCoS, directLabour: fyBudDL, grossProfit: fyBudGP, indirectExpenses: fyBudIE, indirectLabour: fyBudIL, marketingExpenses: fyBudMkt, netProfitBeforeTax: fyBudNP },
      forecast: { revenue: fyFcRev, costOfSales: fyFcCoS, directLabour: fyFcDL, grossProfit: fyFcGP, grossMarginPct: fyFcRev > 0 ? fyFcGP / fyFcRev : 0, indirectExpenses: fyFcIE, indirectLabour: fyFcIL, marketingExpenses: fyFcMkt, netProfitBeforeTax: fyFcNP, netProfitRate: fyFcRev > 0 ? fyFcNP / fyFcRev : 0 },
    },
  };
}

// ─── WIP Schedule (all projects for a report month) ──────────────────────────

export async function calcWIPSchedule(organisationId: string, reportMonth: Date) {
  const projects = await prisma.financeProject.findMany({
    where: {
      organisationId,
      reportMonth,
      deletedAt: null,
      status: { in: ['AWARDED', 'BACKLOG', 'DLP'] },
    },
  });

  const DEFAULT_TARGET_MARGIN = 0.12; // 12% default if not set on project

  return projects.map((p) => {
    const targetMargin = p.targetExitMarginPercent ? n(p.targetExitMarginPercent) : DEFAULT_TARGET_MARGIN;
    const wip = calcWIP(p, targetMargin);
    return {
      financeProjectId: p.id,
      jobNumber: p.jobNumber,
      projectName: p.projectName,
      status: p.status,
      ...wip,
    };
  });
}

// ─── Project Financial Summary ───────────────────────────────────────────────

export async function calcProjectFinancialSummary(
  organisationId: string,
  reportMonth: Date,
  wipSchedule: Awaited<ReturnType<typeof calcWIPSchedule>>
) {
  const projects = await prisma.financeProject.findMany({
    where: { organisationId, reportMonth, deletedAt: null },
    orderBy: [{ status: 'asc' }, { jobNumber: 'asc' }],
  });

  const LABOUR_BENCHMARK_PCT = 0.045; // 4.5% of contract
  const SUB_BENCHMARK_PCT = 0.705;    // 70.5% of contract

  return projects.map((p) => {
    const cv = n(p.forecastContractValue);
    const labourBenchmark = cv * LABOUR_BENCHMARK_PCT;
    const subBenchmark = cv * SUB_BENCHMARK_PCT;
    const labourVariance = n(p.labour) - labourBenchmark;
    const subVariance = n(p.subClaims) - subBenchmark;

    const wipEntry = wipSchedule.find((w) => w.financeProjectId === p.id);
    const flag = wipEntry ? wipEntry.flag : 'NONE';
    const flagReason = wipEntry ? wipEntry.flagReason : null;
    const costToCompleteEstimated = wipEntry ? wipEntry.costToCompleteEstimated : true;

    return {
      id: p.id,
      jobNumber: p.jobNumber,
      projectName: p.projectName,
      status: p.status,
      forecastContractValue: cv,
      forecastFinalCosts: n(p.forecastFinalCosts),
      forecastMarginDollars: n(p.forecastMarginDollars),
      forecastMarginPercent: n(p.forecastMarginPercent),
      targetExitMarginPercent: p.targetExitMarginPercent ? n(p.targetExitMarginPercent) : null,
      claimTotal: n(p.claimTotal),
      claimRetention: n(p.claimRetention),
      subClaims: n(p.subClaims),
      creditors: n(p.creditors),
      labour: n(p.labour),
      totalCost: n(p.totalCost),
      labourBenchmark,
      labourVariance,
      subBenchmark,
      subVariance,
      flag,
      flagReason,
      costToCompleteEstimated,
    };
  });
}

// ─── Unsecured Forecast ───────────────────────────────────────────────────────

export async function calcUnsecuredForecast(organisationId: string, reportMonth: Date) {
  const fy = getFinancialYear(reportMonth);
  const deals = await prisma.plannedDealRevenue.findMany({
    where: { organisationId, financialYear: fy },
  });

  const MONTHS = ['jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun'] as const;

  const fullRevenue: Record<string, number> = {};
  const weightedRevenue: Record<string, number> = {};
  const weightedMargin: Record<string, number> = {};
  let nextYearFull = 0;
  let nextYearWeighted = 0;
  let nextYearMargin = 0;

  for (const m of MONTHS) {
    fullRevenue[m] = 0;
    weightedRevenue[m] = 0;
    weightedMargin[m] = 0;
  }

  for (const d of deals) {
    const prob = n(d.probability);
    const marginPct = n(d.marginPercent);
    for (const m of MONTHS) {
      const rev = n(d[m]);
      fullRevenue[m] += rev;
      weightedRevenue[m] += rev * prob;
      weightedMargin[m] += rev * prob * marginPct;
    }
    nextYearFull += n(d.nextYear);
    nextYearWeighted += n(d.nextYear) * prob;
    nextYearMargin += n(d.nextYear) * prob * marginPct;
  }

  return { fullRevenue, weightedRevenue, weightedMargin, nextYearFull, nextYearWeighted, nextYearMargin, financialYear: fy };
}
