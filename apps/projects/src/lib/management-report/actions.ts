'use server';

import { requireFinanceAccess } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@agero/db';
import { getCVRSummary, type CVRProjectRow } from '@/lib/cvr/actions';
import { MONTH_KEYS_FY27, type MonthKey } from '@/lib/revenue-budget/constants';

// ─── FY27 month → Xero year/month mapping ────────────────────────────────────

const MONTH_KEY_TO_YM: Record<MonthKey, { year: number; month: number }> = {
  jul26: { year: 2026, month: 7 },
  aug26: { year: 2026, month: 8 },
  sep26: { year: 2026, month: 9 },
  oct26: { year: 2026, month: 10 },
  nov26: { year: 2026, month: 11 },
  dec26: { year: 2026, month: 12 },
  jan27: { year: 2027, month: 1 },
  feb27: { year: 2027, month: 2 },
  mar27: { year: 2027, month: 3 },
  apr27: { year: 2027, month: 4 },
  may27: { year: 2027, month: 5 },
  jun27: { year: 2027, month: 6 },
  // FY28 stubs (not needed but satisfy Record<MonthKey, ...>)
  jul27b: { year: 2027, month: 7 },
  aug27b: { year: 2027, month: 8 },
  sep27b: { year: 2027, month: 9 },
  oct27b: { year: 2027, month: 10 },
  nov27b: { year: 2027, month: 11 },
  dec27b: { year: 2027, month: 12 },
  jan28: { year: 2028, month: 1 },
  feb28: { year: 2028, month: 2 },
  mar28: { year: 2028, month: 3 },
  apr28: { year: 2028, month: 4 },
  may28: { year: 2028, month: 5 },
  jun28: { year: 2028, month: 6 },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type MgmtRevenueRow = {
  budget: Record<string, number>;
  secured: Record<string, number>;
  unsecured: Record<string, number>;
  actual: Record<string, number>;
};

export type MgmtPnLRow = {
  budgetRevenue: number;
  budgetDirectCosts: number;
  budgetGrossMargin: number;
  budgetGrossMarginPct: number;
  budgetOverheads: number;
  budgetNetProfit: number;
  budgetNetProfitPct: number;
  actualRevenue: number;
  actualDirectCosts: number;
  actualGrossProfit: number;
  actualGrossMarginPct: number;
  actualOverheads: number;
  actualNetProfit: number;
  actualNetProfitPct: number;
  ytdBudgetRevenue: number;
  ytdActualRevenue: number;
};

export type MgmtCashPosition = {
  current: {
    cash: number; ar: number; ap: number; retentions: number; reportMonth: string;
  } | null;
  prior: {
    cash: number; ar: number; ap: number; retentions: number; reportMonth: string;
  } | null;
};

export type MgmtWipSummary = {
  priorMonthWip: number;
  currentMonthWip: number;
  movement: number;
  journalPosted: boolean;
  xeroJournalId: string | null;
  perProject: { jobNo: string; projectName: string; wip: number; movement: number }[];
};

export type MgmtSnapshotRecord = {
  id: string;
  status: 'DRAFT' | 'LOCKED';
  lockedAt: string | null;
  lockedBy: string | null;
  notes: string | null;
  snapshotData: unknown;
  pdfUrl: string | null;
  commentaryDraft: Record<string, string> | null;
};

export type MgmtLockPreConditions = {
  monthEndLocked: boolean;
  pnlExists: boolean;
  bsExists: boolean;
};

export type MgmtReportPageData = {
  selectedYear: number;
  selectedMonth: number; // 1-12
  fy27MonthKeys: readonly string[];
  revenue: MgmtRevenueRow;
  pnl: MgmtPnLRow;
  cvrRows: CVRProjectRow[];
  cashPosition: MgmtCashPosition;
  wipSummary: MgmtWipSummary | null;
  snapshot: MgmtSnapshotRecord;
  lockPreConditions: MgmtLockPreConditions;
  availableMonths: { year: number; month: number; label: string }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function num(v: unknown): number { return v == null ? 0 : Number(v); }
function isoDate(d: unknown): string { return d instanceof Date ? d.toISOString().split('T')[0] : String(d).split('T')[0]; }

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-AU', { month: 'short', year: '2-digit' });
}

// ─── getReportData ────────────────────────────────────────────────────────────

export async function getReportData(year?: number, month?: number): Promise<{ ok: boolean; data?: MgmtReportPageData; error?: string }> {
  const user = await requireFinanceAccess();
  const orgId = user.organisationId;

  try {
    // Determine default selected month — most recent XeroPnLSnapshot
    const [latestPnl, allPnl, allBS, latestLockedMES] = await Promise.all([
      prisma.xeroPnLSnapshot.findFirst({
        where: { organisationId: orgId },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        select: { year: true, month: true },
      }),
      prisma.xeroPnLSnapshot.findMany({
        where: { organisationId: orgId },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
        select: { year: true, month: true, totalIncome: true, totalCostOfSales: true, grossProfit: true, totalExpenses: true, netProfit: true },
      }),
      prisma.xeroBalanceSheetSnapshot.findMany({
        where: { organisationId: orgId },
        orderBy: { reportMonth: 'desc' },
        take: 2,
        select: { reportMonth: true, cashAndBankBalances: true, accountsReceivable: true, accountsPayable: true, retentionsHeld: true },
      }),
      prisma.monthEndStatus.findFirst({
        where: { organisationId: orgId, status: 'LOCKED' },
        orderBy: { reportMonth: 'desc' },
        include: {
          wipProjectLines: {
            include: { financeProject: { select: { jobNumber: true, projectName: true } } },
          },
        },
      }),
    ]);

    const selYear = year ?? latestPnl?.year ?? 2026;
    const selMonth = month ?? latestPnl?.month ?? 7;

    // Revenue section — all FY27 months
    const [projectBudgets, unsecuredBudgets] = await Promise.all([
      prisma.projectRevenueBudget.findMany({ where: { organisationId: orgId, fyYear: 'FY27' } }),
      prisma.unsecuredRevenueBudget.findMany({ where: { organisationId: orgId, fyYear: 'FY27', deletedAt: null } }),
    ]);

    const budgetRow: Record<string, number> = {};
    const securedRow: Record<string, number> = {};
    const unsecuredRow: Record<string, number> = {};
    const actualRow: Record<string, number> = {};

    for (const key of MONTH_KEYS_FY27) {
      budgetRow[key] = 0;
      securedRow[key] = 0;
      unsecuredRow[key] = 0;
      actualRow[key] = 0;
    }

    // Budget = ProjectRevenueBudget + UnsecuredRevenueBudget (all classifications)
    const allPRB = JSON.parse(JSON.stringify(projectBudgets)) as Record<string, unknown>[];
    const allURB = JSON.parse(JSON.stringify(unsecuredBudgets)) as Record<string, unknown>[];
    for (const key of MONTH_KEYS_FY27) {
      for (const r of allPRB) { budgetRow[key] += num(r[key]); }
      for (const r of allURB) { budgetRow[key] += num(r[key]); }
    }
    // Secured = AWARDED + BACKLOG only from ProjectRevenueBudget
    for (const r of allPRB) {
      if (r['classification'] === 'AWARDED' || r['classification'] === 'BACKLOG') {
        for (const key of MONTH_KEYS_FY27) { securedRow[key] += num(r[key]); }
      }
    }
    // Unsecured = UnsecuredRevenueBudget only
    for (const r of allURB) {
      for (const key of MONTH_KEYS_FY27) { unsecuredRow[key] += num(r[key]); }
    }

    // Actual = XeroPnLSnapshot.totalIncome per month
    for (const pnl of allPnl) {
      const match = MONTH_KEYS_FY27.find((k) => {
        const ym = MONTH_KEY_TO_YM[k];
        return ym && ym.year === pnl.year && ym.month === pnl.month;
      });
      if (match) actualRow[match] = num(pnl.totalIncome);
    }

    // P&L section — selected month
    const selectedPnl = allPnl.find((p) => p.year === selYear && p.month === selMonth);

    // Budget P&L — use averages from last 3 Xero snapshots for direct cost % and overhead
    const last3 = allPnl.slice(-3);
    const avgRevenue = last3.length > 0 ? last3.reduce((s, r) => s + num(r.totalIncome), 0) / last3.length : 0;
    const avgCOS = last3.length > 0 ? last3.reduce((s, r) => s + num(r.totalCostOfSales), 0) / last3.length : 0;
    const avgOverheads = last3.length > 0 ? last3.reduce((s, r) => s + num(r.totalExpenses), 0) / last3.length : 0;
    const directCostPct = avgRevenue > 0 ? avgCOS / avgRevenue : 0.65;
    const overheadMonthlyAvg = avgOverheads;

    // Sprint X.9 — FY-aware budget & YTD. The selected month may sit in any
    // financial year (e.g. Jan 2026 = FY26), not just the FY27 revenue spread.
    // Build the list of months from FY start (July) up to and including the
    // selected month, then resolve budget (from the monthly spread, where it
    // exists for that month) and actual (from Xero) per month.
    const ymOrd = (y: number, m: number) => y * 12 + (m - 1);
    const fyStartYear = selMonth >= 7 ? selYear : selYear - 1; // FY runs Jul..Jun
    const fyStartOrd = ymOrd(fyStartYear, 7);
    const selOrd = ymOrd(selYear, selMonth);

    // Reverse lookup: (year, month) → budget month column key (FY27/FY28 only)
    const keyForYM = (y: number, m: number): string | undefined =>
      MONTH_KEYS_FY27.find((k) => {
        const ym = MONTH_KEY_TO_YM[k];
        return ym && ym.year === y && ym.month === m;
      });

    // Budget revenue for the selected month from its monthly spread (0 if the
    // selected month's FY has no monthly budget data, e.g. FY26).
    const selectedKey = keyForYM(selYear, selMonth);
    const budgetMonthRevenue = selectedKey ? budgetRow[selectedKey] : 0;
    const budgetDirectCosts = budgetMonthRevenue * directCostPct;
    const budgetGrossMargin = budgetMonthRevenue - budgetDirectCosts;
    const budgetNetProfit = budgetGrossMargin - overheadMonthlyAvg;

    // YTD: accumulate from the selected month's FY start (July) to the selected
    // month inclusive. Actual = Xero totalIncome; budget = monthly spread.
    let ytdBudgetRevenue = 0;
    let ytdActualRevenue = 0;
    for (let ord = fyStartOrd; ord <= selOrd; ord++) {
      const y = Math.floor(ord / 12);
      const m = (ord % 12) + 1;
      const key = keyForYM(y, m);
      if (key) ytdBudgetRevenue += budgetRow[key];
      const pnlRec = allPnl.find((p) => p.year === y && p.month === m);
      if (pnlRec) ytdActualRevenue += num(pnlRec.totalIncome);
    }

    const pnl: MgmtPnLRow = {
      budgetRevenue: budgetMonthRevenue,
      budgetDirectCosts,
      budgetGrossMargin,
      budgetGrossMarginPct: budgetMonthRevenue > 0 ? budgetGrossMargin / budgetMonthRevenue : 0,
      budgetOverheads: overheadMonthlyAvg,
      budgetNetProfit,
      budgetNetProfitPct: budgetMonthRevenue > 0 ? budgetNetProfit / budgetMonthRevenue : 0,
      actualRevenue: num(selectedPnl?.totalIncome),
      actualDirectCosts: num(selectedPnl?.totalCostOfSales),
      actualGrossProfit: num(selectedPnl?.grossProfit),
      actualGrossMarginPct: num(selectedPnl?.totalIncome) > 0 ? num(selectedPnl?.grossProfit) / num(selectedPnl?.totalIncome) : 0,
      actualOverheads: num(selectedPnl?.totalExpenses),
      actualNetProfit: num(selectedPnl?.netProfit),
      actualNetProfitPct: num(selectedPnl?.totalIncome) > 0 ? num(selectedPnl?.netProfit) / num(selectedPnl?.totalIncome) : 0,
      ytdBudgetRevenue,
      ytdActualRevenue,
    };

    // CVR summary
    const cvrResult = await getCVRSummary();
    const cvrRows = cvrResult.rows ?? [];

    // Cash position
    const [currentBS, priorBS] = allBS;
    const cashPosition: MgmtCashPosition = {
      current: currentBS ? {
        cash: num(currentBS.cashAndBankBalances),
        ar: num(currentBS.accountsReceivable),
        ap: num(currentBS.accountsPayable),
        retentions: num(currentBS.retentionsHeld),
        reportMonth: isoDate(currentBS.reportMonth),
      } : null,
      prior: priorBS ? {
        cash: num(priorBS.cashAndBankBalances),
        ar: num(priorBS.accountsReceivable),
        ap: num(priorBS.accountsPayable),
        retentions: num(priorBS.retentionsHeld),
        reportMonth: isoDate(priorBS.reportMonth),
      } : null,
    };

    // WIP summary from latest locked month
    let wipSummary: MgmtWipSummary | null = null;
    if (latestLockedMES) {
      const lines = latestLockedMES.wipProjectLines;
      const currentWip = lines.reduce((s, w) => s + num(w.catWip), 0);
      const priorWip = lines.reduce((s, w) => s + num(w.priorMonthWip), 0);
      wipSummary = {
        priorMonthWip: priorWip,
        currentMonthWip: currentWip,
        movement: currentWip - priorWip,
        journalPosted: !!latestLockedMES.xeroJournalPostedAt,
        xeroJournalId: null,
        perProject: lines.map((w) => ({
          jobNo: w.jobNo,
          projectName: w.projectName,
          wip: num(w.catWip),
          movement: num(w.wipMovement),
        })),
      };
    }

    // ManagementReportSnapshot — get or create for selected month
    const reportMonthDate = new Date(Date.UTC(selYear, selMonth - 1, 1));
    let snapshot = await prisma.managementReportSnapshot.findUnique({
      where: { organisationId_reportMonth: { organisationId: orgId, reportMonth: reportMonthDate } },
      select: { id: true, status: true, lockedAt: true, lockedBy: true, notes: true, snapshotData: true, pdfUrl: true, commentaryDraft: true },
    });
    if (!snapshot) {
      snapshot = await prisma.managementReportSnapshot.create({
        data: { organisationId: orgId, reportMonth: reportMonthDate, status: 'DRAFT' },
        select: { id: true, status: true, lockedAt: true, lockedBy: true, notes: true, snapshotData: true, pdfUrl: true, commentaryDraft: true },
      });
    }

    // Lock pre-conditions
    const [lockedMES, pnlExists, bsExists] = await Promise.all([
      prisma.monthEndStatus.findFirst({
        where: { organisationId: orgId, status: 'LOCKED', reportMonth: reportMonthDate },
        select: { id: true },
      }),
      prisma.xeroPnLSnapshot.findFirst({
        where: { organisationId: orgId, year: selYear, month: selMonth },
        select: { id: true },
      }),
      prisma.xeroBalanceSheetSnapshot.findFirst({
        where: { organisationId: orgId, reportMonth: reportMonthDate },
        select: { id: true },
      }),
    ]);

    // Available months list (all months that have at least P&L data)
    const availableMonths = allPnl.map((p) => ({
      year: p.year, month: p.month, label: monthLabel(p.year, p.month),
    }));
    // Add current FY months not yet in Xero
    for (const key of MONTH_KEYS_FY27) {
      const ym = MONTH_KEY_TO_YM[key];
      if (!ym) continue;
      if (!availableMonths.find((m) => m.year === ym.year && m.month === ym.month)) {
        availableMonths.push({ year: ym.year, month: ym.month, label: monthLabel(ym.year, ym.month) });
      }
    }
    availableMonths.sort((a, b) => a.year !== b.year ? b.year - a.year : b.month - a.month);

    return {
      ok: true,
      data: {
        selectedYear: selYear,
        selectedMonth: selMonth,
        fy27MonthKeys: MONTH_KEYS_FY27,
        revenue: { budget: budgetRow, secured: securedRow, unsecured: unsecuredRow, actual: actualRow },
        pnl,
        cvrRows,
        cashPosition,
        wipSummary,
        snapshot: {
          id: snapshot.id,
          status: snapshot.status as 'DRAFT' | 'LOCKED',
          lockedAt: snapshot.lockedAt ? isoDate(snapshot.lockedAt) : null,
          lockedBy: snapshot.lockedBy,
          notes: snapshot.notes,
          snapshotData: snapshot.snapshotData,
          pdfUrl: snapshot.pdfUrl,
          commentaryDraft: snapshot.commentaryDraft as Record<string, string> | null,
        },
        lockPreConditions: {
          monthEndLocked: !!lockedMES,
          pnlExists: !!pnlExists,
          bsExists: !!bsExists,
        },
        availableMonths,
      },
    };
  } catch (e) {
    console.error('[management-report] getReportData error:', e);
    return { ok: false, error: 'Failed to load management report data.' };
  }
}

// ─── lockReport ───────────────────────────────────────────────────────────────

export async function lockReport(snapshotId: string, snapshotJson: unknown): Promise<{ ok: boolean; error?: string }> {
  const user = await requireFinanceAccess();
  try {
    const snap = await prisma.managementReportSnapshot.findUnique({
      where: { id: snapshotId },
      select: { organisationId: true, status: true, commentaryDraft: true },
    });
    if (!snap || snap.organisationId !== user.organisationId) return { ok: false, error: 'Not found.' };
    if (snap.status === 'LOCKED') return { ok: false, error: 'Already locked.' };

    await prisma.managementReportSnapshot.update({
      where: { id: snapshotId },
      data: {
        status: 'LOCKED',
        lockedAt: new Date(),
        lockedBy: user.id,
        snapshotData: JSON.parse(JSON.stringify({
          ...(snapshotJson as object),
          commentary: snap.commentaryDraft ?? null,
        })),
      },
    });
    return { ok: true };
  } catch (e) {
    console.error('[management-report] lockReport error:', e);
    return { ok: false, error: 'Failed to lock report.' };
  }
}

// ─── unlockReport ─────────────────────────────────────────────────────────────

export async function unlockReport(snapshotId: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireFinanceAccess();
  if (reason.length < 20) return { ok: false, error: 'Reason must be at least 20 characters.' };
  try {
    const snap = await prisma.managementReportSnapshot.findUnique({ where: { id: snapshotId }, select: { organisationId: true } });
    if (!snap || snap.organisationId !== user.organisationId) return { ok: false, error: 'Not found.' };

    await prisma.managementReportSnapshot.update({
      where: { id: snapshotId },
      data: { status: 'DRAFT', lockedAt: null, lockedBy: null, snapshotData: Prisma.DbNull },
    });
    return { ok: true };
  } catch (e) {
    console.error('[management-report] unlockReport error:', e);
    return { ok: false, error: 'Failed to unlock report.' };
  }
}

// ─── saveNotes ────────────────────────────────────────────────────────────────

export async function saveNotes(snapshotId: string, notes: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireFinanceAccess();
  try {
    const snap = await prisma.managementReportSnapshot.findUnique({ where: { id: snapshotId }, select: { organisationId: true, status: true } });
    if (!snap || snap.organisationId !== user.organisationId) return { ok: false, error: 'Not found.' };
    if (snap.status === 'LOCKED') return { ok: false, error: 'Cannot edit locked report.' };

    await prisma.managementReportSnapshot.update({ where: { id: snapshotId }, data: { notes } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'Failed to save notes.' };
  }
}

// ─── savePdfUrl ───────────────────────────────────────────────────────────────

export async function savePdfUrl(snapshotId: string, pdfUrl: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireFinanceAccess();
  try {
    const snap = await prisma.managementReportSnapshot.findUnique({ where: { id: snapshotId }, select: { organisationId: true } });
    if (!snap || snap.organisationId !== user.organisationId) return { ok: false, error: 'Not found.' };
    await prisma.managementReportSnapshot.update({ where: { id: snapshotId }, data: { pdfGeneratedAt: new Date(), pdfUrl } });
    return { ok: true };
  } catch {
    return { ok: false, error: 'Failed to save PDF URL.' };
  }
}
