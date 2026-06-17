'use server';

import { requireFinanceAccess } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CVRProjectRow = {
  projectId: string;
  jobNo: string;
  projectName: string;
  classification: string | null; // from BacklogBudget
  // From latest FinanceProjectSnapshot
  snapshotDate: string | null;
  forecastContract: number;
  forecastMarginPct: number;
  marginToEarn: number;
  billingLessCost: number;
  marginRealised: number;
  overClaim: number;
  nettRetention: number;
  nettCashFlow: number;
  // From WipProjectLine (latest locked month)
  wip: number;
  wipMonth: string | null;
  // Derived
  budgetMarginPct: number; // from BacklogBudget budgetRevenue context — we use forecastMarginPct of first snapshot as proxy if no direct budget
  health: 'GREEN' | 'AMBER' | 'RED' | 'GREY';
};

export type CVRDetailRow = {
  project: {
    id: string;
    jobNo: string;
    projectName: string;
    status: string;
    forecastContractValue: number;
    forecastFinalCosts: number;
    riskAndOpportunity: number;
    forecastMarginDollars: number;
    forecastMarginPercent: number;
    targetExitMarginPercent: number | null;
    claimTotal: number;
    claimRetention: number;
    totalCost: number;
    billingLessCost: number | null;
    marginToEarn: number | null;
    marginRealised: number | null;
    overClaim: number | null;
    nettRetention: number | null;
    nettCashFlow: number | null;
  };
  backlogBudget: {
    classification: string;
    budgetRevenue: number;
  } | null;
  latestSnapshot: CVRSnapshotRow | null;
  snapshotHistory: CVRSnapshotRow[];
  wipHistory: CVRWipRow[];
  revenueBudget: Record<string, number>; // monthKey → amount
};

export type CVRSnapshotRow = {
  asAtDate: string;
  forecastContract: number;
  forecastFinalCosts: number;
  forecastMargin: number;
  roAdjust: number;
  marginInclRo: number;
  forecastMarginPct: number;
  claimTotal: number;
  claimRetention: number;
  totalCost: number;
  billingLessCost: number;
  marginToEarn: number;
  marginRealised: number;
  overClaim: number;
  nettRetention: number;
  nettCashFlow: number;
  wip: number;
};

export type CVRWipRow = {
  monthLabel: string;
  reportMonth: string;
  catWip: number;
  priorMonthWip: number;
  wipMovement: number;
  journalPostedAt: string | null;
  monthEndStatus: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeHealth(row: { forecastMarginPct: number; marginToEarn: number }): CVRProjectRow['health'] {
  if (row.forecastMarginPct === 0 && row.marginToEarn === 0) return 'GREY';
  if (row.marginToEarn < 0 || row.forecastMarginPct < 0.05) return 'RED';
  if (row.forecastMarginPct < 0.10) return 'AMBER';
  return 'GREEN';
}

function num(v: unknown): number {
  return v == null ? 0 : Number(v);
}

function isoDate(d: unknown): string {
  return d instanceof Date ? d.toISOString().split('T')[0] : String(d).split('T')[0];
}

const PRB_KEYS = ['jul26', 'aug26', 'sep26', 'oct26', 'nov26', 'dec26', 'jan27', 'feb27', 'mar27', 'apr27', 'may27', 'jun27'] as const;

// ─── getCVRSummary ─────────────────────────────────────────────────────────────

export async function getCVRSummary(month?: string): Promise<{ ok: boolean; rows?: CVRProjectRow[]; latestMonth?: string; error?: string }> {
  const user = await requireFinanceAccess();
  const orgId = user.organisationId;

  try {
    // Get all active (non-CLOSED) projects
    const projects = await prisma.financeProject.findMany({
      where: { organisationId: orgId, deletedAt: null, status: { not: 'CLOSED' } },
      include: {
        snapshots: {
          orderBy: { asAtDate: 'desc' },
          take: 1,
        },
        backlogBudgets: {
          where: { fyYear: 'FY27' },
          take: 1,
        },
      },
      orderBy: { jobNumber: 'asc' },
    });

    // Get latest locked month for WIP lookup
    const latestLocked = await prisma.monthEndStatus.findFirst({
      where: { organisationId: orgId, status: 'LOCKED' },
      orderBy: { reportMonth: 'desc' },
      select: { id: true, reportMonth: true },
    });

    // Get WIP lines for that locked month
    const wipMap = new Map<string, { catWip: number; reportMonth: Date }>();
    if (latestLocked) {
      const wipLines = await prisma.wipProjectLine.findMany({
        where: { monthEndStatusId: latestLocked.id },
        select: { financeProjectId: true, catWip: true },
      });
      wipLines.forEach((w) => {
        wipMap.set(w.financeProjectId, { catWip: num(w.catWip), reportMonth: latestLocked.reportMonth });
      });
    }

    // Determine the effective snapshot month
    const snapshotDates = projects.flatMap((p) => p.snapshots.map((s) => s.asAtDate.toISOString().split('T')[0]));
    const latestMonth = snapshotDates.length > 0 ? snapshotDates.sort().reverse()[0] : undefined;

    // Filter IGNORE classification
    const rows: CVRProjectRow[] = projects
      .filter((p) => {
        const bb = p.backlogBudgets[0];
        if (bb?.classification === 'IGNORE') return false;
        return true;
      })
      .map((p) => {
        const snap = p.snapshots[0];
        const bb = p.backlogBudgets[0];
        const wipEntry = wipMap.get(p.id);

        // Sprint X.9 — derive Forecast Margin % from dollar fields rather than the
        // stored forecast_margin_pct column. That column is Decimal(5,4) and CAT
        // imports populated it with a doubly-divided value (showing ~0.1–0.6%).
        // (Contract − Forecast Final Costs) / Contract gives the true fraction,
        // e.g. job 1282 → 27.5%. Falls back to the stored pct only if contract is 0.
        const snapContract = snap ? num(snap.forecastContract) : 0;
        const snapFinalCosts = snap ? num(snap.forecastFinalCosts) : 0;
        const forecastMarginPct = snap
          ? (snapContract > 0 ? (snapContract - snapFinalCosts) / snapContract : num(snap.forecastMarginPct))
          : 0;
        const marginToEarn = snap ? num(snap.marginToEarn) : 0;

        const row = {
          projectId: p.id,
          jobNo: p.jobNumber,
          projectName: p.projectName,
          classification: bb?.classification ?? null,
          snapshotDate: snap ? isoDate(snap.asAtDate) : null,
          forecastContract: snap ? num(snap.forecastContract) : num(p.forecastContractValue),
          forecastMarginPct,
          marginToEarn,
          billingLessCost: snap ? num(snap.billingLessCost) : 0,
          marginRealised: snap ? num(snap.marginRealised) : 0,
          overClaim: snap ? num(snap.overClaim) : 0,
          nettRetention: snap ? num(snap.nettRetention) : 0,
          nettCashFlow: snap ? num(snap.nettCashFlow) : 0,
          wip: wipEntry?.catWip ?? (snap ? num(snap.wip) : 0),
          wipMonth: wipEntry ? isoDate(wipEntry.reportMonth) : null,
          budgetMarginPct: forecastMarginPct, // no separate budget pct stored; use forecast as reference
          health: snap ? computeHealth({ forecastMarginPct, marginToEarn }) : 'GREY',
        } satisfies CVRProjectRow;

        return row;
      });

    return { ok: true, rows, latestMonth };
  } catch (e) {
    console.error('[cvr] getCVRSummary error:', e);
    return { ok: false, error: 'Failed to load CVR data.' };
  }
}

// ─── getCVRProject ─────────────────────────────────────────────────────────────

export async function getCVRProject(projectId: string): Promise<{ ok: boolean; data?: CVRDetailRow; error?: string }> {
  const user = await requireFinanceAccess();
  const orgId = user.organisationId;

  try {
    const project = await prisma.financeProject.findFirst({
      where: { id: projectId, organisationId: orgId },
      include: {
        snapshots: { orderBy: { asAtDate: 'desc' }, take: 6 },
        backlogBudgets: { where: { fyYear: 'FY27' }, take: 1 },
        projectRevenueBudgets: { where: { fyYear: 'FY27' }, take: 1 },
        wipProjectLines: {
          include: {
            monthEndStatus: { select: { reportMonth: true, status: true, xeroJournalPostedAt: true } },
          },
          orderBy: { monthEndStatus: { reportMonth: 'desc' } },
          take: 12,
        },
      },
    });

    if (!project) return { ok: false, error: 'Project not found.' };

    const bb = project.backlogBudgets[0] ?? null;
    const prb = project.projectRevenueBudgets[0] ?? null;

    const revenueBudget: Record<string, number> = {};
    if (prb) {
      for (const key of PRB_KEYS) {
        revenueBudget[key] = num((prb as Record<string, unknown>)[key]);
      }
    }

    const snapHistory: CVRSnapshotRow[] = project.snapshots.map((s) => ({
      asAtDate: isoDate(s.asAtDate),
      forecastContract: num(s.forecastContract),
      forecastFinalCosts: num(s.forecastFinalCosts),
      forecastMargin: num(s.forecastMargin),
      roAdjust: num(s.roAdjust),
      marginInclRo: num(s.marginInclRo),
      forecastMarginPct: num(s.forecastMarginPct),
      claimTotal: num(s.claimTotal),
      claimRetention: num(s.claimRetention),
      totalCost: num(s.totalCost),
      billingLessCost: num(s.billingLessCost),
      marginToEarn: num(s.marginToEarn),
      marginRealised: num(s.marginRealised),
      overClaim: num(s.overClaim),
      nettRetention: num(s.nettRetention),
      nettCashFlow: num(s.nettCashFlow),
      wip: num(s.wip),
    }));

    const wipHistory: CVRWipRow[] = project.wipProjectLines.map((w) => ({
      monthLabel: w.monthEndStatus.reportMonth.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }),
      reportMonth: isoDate(w.monthEndStatus.reportMonth),
      catWip: num(w.catWip),
      priorMonthWip: num(w.priorMonthWip),
      wipMovement: num(w.wipMovement),
      journalPostedAt: w.monthEndStatus.xeroJournalPostedAt ? isoDate(w.monthEndStatus.xeroJournalPostedAt) : null,
      monthEndStatus: w.monthEndStatus.status,
    }));

    return {
      ok: true,
      data: {
        project: {
          id: project.id,
          jobNo: project.jobNumber,
          projectName: project.projectName,
          status: project.status,
          forecastContractValue: num(project.forecastContractValue),
          forecastFinalCosts: num(project.forecastFinalCosts),
          riskAndOpportunity: num(project.riskAndOpportunity),
          forecastMarginDollars: num(project.forecastMarginDollars),
          forecastMarginPercent: num(project.forecastMarginPercent),
          targetExitMarginPercent: project.targetExitMarginPercent != null ? num(project.targetExitMarginPercent) : null,
          claimTotal: num(project.claimTotal),
          claimRetention: num(project.claimRetention),
          totalCost: num(project.totalCost),
          billingLessCost: project.billingLessCost != null ? num(project.billingLessCost) : null,
          marginToEarn: project.marginToEarn != null ? num(project.marginToEarn) : null,
          marginRealised: project.marginRealised != null ? num(project.marginRealised) : null,
          overClaim: project.overClaim != null ? num(project.overClaim) : null,
          nettRetention: project.nettRetention != null ? num(project.nettRetention) : null,
          nettCashFlow: project.nettCashFlow != null ? num(project.nettCashFlow) : null,
        },
        backlogBudget: bb ? { classification: bb.classification, budgetRevenue: num(bb.budgetRevenue) } : null,
        latestSnapshot: snapHistory[0] ?? null,
        snapshotHistory: snapHistory,
        wipHistory,
        revenueBudget,
      },
    };
  } catch (e) {
    console.error('[cvr] getCVRProject error:', e);
    return { ok: false, error: 'Failed to load project CVR data.' };
  }
}

// ─── getProjectMarginTrend ────────────────────────────────────────────────────

export async function getProjectMarginTrend(projectId: string, months = 6): Promise<{ ok: boolean; trend?: { date: string; pct: number }[]; error?: string }> {
  const user = await requireFinanceAccess();
  const orgId = user.organisationId;

  try {
    const snaps = await prisma.financeProjectSnapshot.findMany({
      where: { financeProjectId: projectId, organisationId: orgId },
      orderBy: { asAtDate: 'asc' },
      take: months,
      select: { asAtDate: true, forecastMarginPct: true },
    });

    return {
      ok: true,
      trend: snaps.map((s) => ({
        date: isoDate(s.asAtDate),
        pct: num(s.forecastMarginPct) * 100,
      })),
    };
  } catch (e) {
    console.error('[cvr] getProjectMarginTrend error:', e);
    return { ok: false, error: 'Failed to load trend data.' };
  }
}

// ─── exportCVRCSV ─────────────────────────────────────────────────────────────

export async function exportCVRCSV(): Promise<{ ok: boolean; csv?: string; error?: string }> {
  const result = await getCVRSummary();
  if (!result.ok || !result.rows) return { ok: false, error: result.error };

  const headers = [
    'Job No', 'Project Name', 'Classification',
    'Forecast Contract', 'Forecast Margin %', 'Margin to Earn',
    'Billing Less Cost', 'Margin Realised', 'Over Claim',
    'Nett Retention', 'Nett Cash Flow', 'WIP', 'Health',
  ];

  const pct = (v: number) => (v * 100).toFixed(2) + '%';
  const money = (v: number) => v.toFixed(2);

  const rows = result.rows.map((r) => [
    r.jobNo,
    `"${r.projectName.replace(/"/g, '""')}"`,
    r.classification ?? '',
    money(r.forecastContract),
    pct(r.forecastMarginPct),
    money(r.marginToEarn),
    money(r.billingLessCost),
    money(r.marginRealised),
    money(r.overClaim),
    money(r.nettRetention),
    money(r.nettCashFlow),
    money(r.wip),
    r.health,
  ].join(','));

  return { ok: true, csv: [headers.join(','), ...rows].join('\n') };
}
