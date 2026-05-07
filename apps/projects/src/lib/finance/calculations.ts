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
  return month >= 7 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
}

export function getMonthsYtd(reportMonth: Date): Date[] {
  const fy = getFinancialYear(reportMonth);
  const months: Date[] = [];
  // FY runs Jul–Jun
  for (let m = 7; m <= 12; m++) {
    const d = new Date(Date.UTC(fy, m - 1, 1));
    if (d <= reportMonth) months.push(d);
  }
  for (let m = 1; m <= 6; m++) {
    const d = new Date(Date.UTC(fy + 1, m - 1, 1));
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

export async function calcBusinessUnitSummary(organisationId: string, reportMonth: Date) {
  const monthStr = reportMonth.toISOString();
  const fy = getFinancialYear(reportMonth);
  const ytdMonths = getMonthsYtd(reportMonth);

  const [projects, pnl, bankBalances, budgetRows, securedForecasts] = await Promise.all([
    prisma.financeProject.findMany({
      where: { organisationId, reportMonth: reportMonth, deletedAt: null },
    }),
    prisma.xeroPnL.findFirst({
      where: { organisationId, reportMonth: reportMonth },
    }),
    prisma.xeroBankBalance.findMany({
      where: { organisationId, reportMonth: reportMonth },
    }),
    prisma.annualBudget.findMany({
      where: { organisationId, financialYear: fy },
    }),
    prisma.securedForecast.findMany({
      where: { organisationId, financialYear: fy },
    }),
  ]);

  const awarded = projects.filter((p) => p.status === 'AWARDED');
  const backlog = projects.filter((p) => p.status === 'BACKLOG');

  const awardedMargin = awarded.reduce((s, p) => s + n(p.forecastMarginDollars), 0);
  const awardedCV = awarded.reduce((s, p) => s + n(p.forecastContractValue), 0);
  const backlogMargin = backlog.reduce((s, p) => s + n(p.forecastMarginDollars), 0);
  const backlogCV = backlog.reduce((s, p) => s + n(p.forecastContractValue), 0);

  const netProjectCashFlow = projects.reduce((s, p) => s + n(p.claimTotal) - n(p.totalCost), 0);
  const grossMarginFromPnl = pnl ? n(pnl.grossProfit) : 0;
  const netCashVsGrossMargin = netProjectCashFlow - grossMarginFromPnl;

  // Liquidity ratios from Xero P&L (use trade debtors/creditors as proxies)
  const ar = pnl?.tradeDebtors ? n(pnl.tradeDebtors) : 0;
  const ap = pnl?.tradeCreditors ? n(pnl.tradeCreditors) : 0;
  const cash = bankBalances.reduce((s, b) => s + n(b.balance), 0);
  const revenue = pnl ? n(pnl.revenue) : 0;

  const currentRatio = ap > 0 ? (cash + ar) / ap : null;
  const quickRatio = ap > 0 ? (cash + ar) / ap : null;
  const workingCapital = cash + ar - ap;
  const debtorDays = revenue > 0 ? (ar / revenue) * 30 : pnl?.debtorDays ? n(pnl.debtorDays) : null;
  const creditorDays = pnl ? n(pnl.creditorDays) : null;

  // FY forecast margin (awarded projects projected revenue * margin %)
  const remainingMonths = getRemainingFYMonths(reportMonth);
  let fyForecastMargin = awardedMargin;
  for (const sf of securedForecasts.filter((s) => s.status === 'AWARDED' || s.status === 'BACKLOG')) {
    const marginPct = n(sf.marginPercent);
    for (const m of remainingMonths) {
      const key = monthKey(m) as keyof typeof sf;
      const rev = n(sf[key as keyof typeof sf]);
      fyForecastMargin += rev * marginPct;
    }
  }

  // Budget figures
  const budgetMarginRow = budgetRows.find((r) => r.lineItem.toLowerCase().includes('margin'));
  const budgetAwardedMargin = budgetMarginRow ? ytdMonths.reduce((s, m) => {
    const k = getMonthBudgetKey(m) as keyof typeof budgetMarginRow;
    return s + n(budgetMarginRow[k]);
  }, 0) : null;

  return {
    awardedMargin,
    awardedMarginRate: awardedCV > 0 ? awardedMargin / awardedCV : 0,
    backlogMargin,
    backlogMarginRate: backlogCV > 0 ? backlogMargin / backlogCV : 0,
    netProjectCashFlow,
    netCashVsGrossMargin,
    currentRatio,
    quickRatio,
    workingCapital,
    debtorDays,
    creditorDays,
    fyForecastMargin,
    budgetAwardedMargin,
    cashBalance: cash,
    reportMonth: monthStr,
  };
}

function getRemainingFYMonths(reportMonth: Date): Date[] {
  const fy = getFinancialYear(reportMonth);
  const allFYMonths: Date[] = [];
  for (let m = 7; m <= 12; m++) allFYMonths.push(new Date(Date.UTC(fy, m - 1, 1)));
  for (let m = 1; m <= 6; m++) allFYMonths.push(new Date(Date.UTC(fy + 1, m - 1, 1)));
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

  const [pnlRecords, budgetRows, securedForecasts] = await Promise.all([
    prisma.xeroPnL.findMany({ where: { organisationId } }),
    prisma.annualBudget.findMany({ where: { organisationId, financialYear: fy } }),
    prisma.securedForecast.findMany({ where: { organisationId, financialYear: fy } }),
  ]);

  const thisMonthPnl = pnlRecords.find(
    (p) => monthKey(p.reportMonth) === monthKey(reportMonth)
  );

  type PnLRow = typeof pnlRecords[number];
  const sum = (field: keyof PnLRow) => {
    return ytdMonths.reduce((s, m) => {
      const rec = pnlRecords.find((p) => monthKey(p.reportMonth) === monthKey(m));
      return s + (rec ? n(rec[field]) : 0);
    }, 0);
  };

  const revenueYtd = sum('revenue');
  const cosYtd = sum('costOfSales');
  const dlYtd = sum('directLabour');
  const gpYtd = sum('grossProfit');
  const indirectExpYtd = sum('indirectExpenses');
  const indirectLabYtd = sum('indirectLabour');
  const mktExpYtd = sum('marketingExpenses');
  const npYtd = sum('netProfitBeforeTax');

  // FY Forecast = YTD actuals + remaining secured forecast revenue * margins
  const remainingMonths = getRemainingFYMonths(reportMonth);
  let fyForecastRevenue = revenueYtd;
  for (const sf of securedForecasts) {
    const marginPct = n(sf.marginPercent);
    for (const m of remainingMonths) {
      const key = getMonthBudgetKey(m) as keyof typeof sf;
      const rev = n(sf[key]);
      fyForecastRevenue += rev;
    }
  }

  function getBudgetYtd(lineItemPattern: string) {
    const row = budgetRows.find((r) => r.lineItem.toLowerCase().includes(lineItemPattern));
    if (!row) return 0;
    return ytdMonths.reduce((s, m) => {
      const k = getMonthBudgetKey(m) as keyof typeof row;
      return s + n(row[k]);
    }, 0);
  }

  const budgetRevYtd = getBudgetYtd('revenue');
  const budgetGpYtd = getBudgetYtd('gross profit');
  const budgetNpYtd = getBudgetYtd('net profit');
  const budgetCoSYtd = getBudgetYtd('cost of sales');

  return {
    thisMonth: {
      revenue: thisMonthPnl ? n(thisMonthPnl.revenue) : 0,
      costOfSales: thisMonthPnl ? n(thisMonthPnl.costOfSales) : 0,
      directLabour: thisMonthPnl ? n(thisMonthPnl.directLabour) : 0,
      grossProfit: thisMonthPnl ? n(thisMonthPnl.grossProfit) : 0,
      grossMarginPct: thisMonthPnl && n(thisMonthPnl.revenue) > 0 ? n(thisMonthPnl.grossProfit) / n(thisMonthPnl.revenue) : 0,
      indirectExpenses: thisMonthPnl ? n(thisMonthPnl.indirectExpenses) : 0,
      indirectLabour: thisMonthPnl ? n(thisMonthPnl.indirectLabour) : 0,
      marketingExpenses: thisMonthPnl ? n(thisMonthPnl.marketingExpenses) : 0,
      netProfitBeforeTax: thisMonthPnl ? n(thisMonthPnl.netProfitBeforeTax) : 0,
      netProfitRate: thisMonthPnl && n(thisMonthPnl.revenue) > 0 ? n(thisMonthPnl.netProfitBeforeTax) / n(thisMonthPnl.revenue) : 0,
    },
    ytd: {
      revenue: revenueYtd,
      costOfSales: cosYtd,
      directLabour: dlYtd,
      grossProfit: gpYtd,
      grossMarginPct: revenueYtd > 0 ? gpYtd / revenueYtd : 0,
      indirectExpenses: indirectExpYtd,
      indirectLabour: indirectLabYtd,
      marketingExpenses: mktExpYtd,
      netProfitBeforeTax: npYtd,
      netProfitRate: revenueYtd > 0 ? npYtd / revenueYtd : 0,
    },
    fyForecast: {
      revenue: fyForecastRevenue,
    },
    budget: {
      revenue: budgetRevYtd,
      costOfSales: budgetCoSYtd,
      grossProfit: budgetGpYtd,
      netProfitBeforeTax: budgetNpYtd,
    },
    variance: {
      revenue: revenueYtd - budgetRevYtd,
      revenuePct: budgetRevYtd !== 0 ? (revenueYtd - budgetRevYtd) / Math.abs(budgetRevYtd) : 0,
      grossProfit: gpYtd - budgetGpYtd,
      grossProfitPct: budgetGpYtd !== 0 ? (gpYtd - budgetGpYtd) / Math.abs(budgetGpYtd) : 0,
      netProfit: npYtd - budgetNpYtd,
      netProfitPct: budgetNpYtd !== 0 ? (npYtd - budgetNpYtd) / Math.abs(budgetNpYtd) : 0,
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
