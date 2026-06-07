'use server';

import { requireDirector, requireFinanceAccess } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import type { BacklogClassification, BacklogBudgetStatus } from '@agero/db';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FYSettingsRow = {
  id: string;
  organisationId: string;
  currentFY: string;
  draftOpenMonth: number;
  draftOpenDay: number;
  lockOpenMonth: number;
  lockOpenDay: number;
};

export type BacklogRow = {
  id: string;
  jobNumber: string;
  projectName: string;
  financeProjectId: string;
  fyYear: string;
  classification: BacklogClassification;
  budgetRevenue: string;
  notes: string | null;
  status: BacklogBudgetStatus;
  lockedAt: string | null;
  lastAdjustedAt: string | null;
  adjustmentReason: string | null;
  // Latest snapshot context
  latestSnapshot: {
    asAtDate: string;
    forecastContract: string;
    marginToEarn: string;
    nettRetention: string;
    nettCashFlow: string;
    billingLessCost: string;
    practicalCompletion: string | null;
  } | null;
};

export type CATTrendRow = {
  asAtDate: string;
  forecastContract: string;
  totalCost: string;
  forecastMargin: string;
  forecastMarginPct: string;
  roAdjust: string;
};

export type PageMode = 'UPCOMING' | 'DRAFT' | 'READY_TO_LOCK' | 'LOCKED';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveMode(settings: FYSettingsRow, today: Date): PageMode {
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  const draftDate = new Date(year, settings.draftOpenMonth - 1, settings.draftOpenDay);
  const lockDate = new Date(year, settings.lockOpenMonth - 1, settings.lockOpenDay);

  if (today < draftDate) return 'UPCOMING';
  if (today >= lockDate) return 'READY_TO_LOCK';
  return 'DRAFT';
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function getFYSettings(): Promise<{ ok: boolean; settings?: FYSettingsRow; mode?: PageMode; error?: string }> {
  const user = await requireFinanceAccess();
  try {
    let settings = await prisma.fYSettings.findUnique({ where: { organisationId: user.organisationId } });
    if (!settings) {
      settings = await prisma.fYSettings.create({
        data: {
          organisationId: user.organisationId,
          currentFY: 'FY27',
          draftOpenMonth: 4,
          draftOpenDay: 1,
          lockOpenMonth: 7,
          lockOpenDay: 1,
        },
      });
    }
    const row: FYSettingsRow = JSON.parse(JSON.stringify(settings));
    const mode = deriveMode(row, new Date());
    return { ok: true, settings: row, mode };
  } catch (e) {
    console.error('[backlog] getFYSettings error:', e);
    return { ok: false, error: 'Failed to load FY settings.' };
  }
}

export async function updateFYSettings(input: {
  currentFY: string;
  draftOpenMonth: number;
  draftOpenDay: number;
  lockOpenMonth: number;
  lockOpenDay: number;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  try {
    await prisma.fYSettings.upsert({
      where: { organisationId: user.organisationId },
      update: input,
      create: { organisationId: user.organisationId, ...input },
    });
    return { ok: true };
  } catch (e) {
    console.error('[backlog] updateFYSettings error:', e);
    return { ok: false, error: 'Failed to update FY settings.' };
  }
}

export async function listBacklogBudget(fyYear: string): Promise<{ ok: boolean; rows?: BacklogRow[]; error?: string }> {
  const user = await requireFinanceAccess();
  try {
    const projects = await prisma.financeProject.findMany({
      where: { organisationId: user.organisationId, deletedAt: null },
      orderBy: [{ jobNumber: 'asc' }],
      select: {
        id: true,
        jobNumber: true,
        projectName: true,
        backlogBudgets: {
          where: { fyYear },
          take: 1,
          select: {
            id: true,
            fyYear: true,
            classification: true,
            budgetRevenue: true,
            notes: true,
            status: true,
            lockedAt: true,
            lastAdjustedAt: true,
            adjustmentReason: true,
          },
        },
        snapshots: {
          orderBy: { asAtDate: 'desc' },
          take: 1,
          select: {
            asAtDate: true,
            forecastContract: true,
            marginToEarn: true,
            nettRetention: true,
            nettCashFlow: true,
            billingLessCost: true,
            practicalCompletion: true,
          },
        },
      },
    });

    const rows: BacklogRow[] = projects.map((p) => {
      const budget = p.backlogBudgets[0];
      const snap = p.snapshots[0];
      return {
        id: budget?.id ?? '',
        jobNumber: p.jobNumber,
        projectName: p.projectName,
        financeProjectId: p.id,
        fyYear,
        classification: budget?.classification ?? 'AWARDED',
        budgetRevenue: budget?.budgetRevenue?.toString() ?? '0',
        notes: budget?.notes ?? null,
        status: budget?.status ?? 'DRAFT',
        lockedAt: budget?.lockedAt?.toISOString() ?? null,
        lastAdjustedAt: budget?.lastAdjustedAt?.toISOString() ?? null,
        adjustmentReason: budget?.adjustmentReason ?? null,
        latestSnapshot: snap
          ? {
              asAtDate: snap.asAtDate.toISOString(),
              forecastContract: snap.forecastContract.toString(),
              marginToEarn: snap.marginToEarn.toString(),
              nettRetention: snap.nettRetention.toString(),
              nettCashFlow: snap.nettCashFlow.toString(),
              billingLessCost: snap.billingLessCost.toString(),
              practicalCompletion: snap.practicalCompletion?.toISOString() ?? null,
            }
          : null,
      };
    });

    return { ok: true, rows };
  } catch (e) {
    console.error('[backlog] listBacklogBudget error:', e);
    return { ok: false, error: 'Failed to load backlog budget data.' };
  }
}

export async function upsertBacklogBudget(input: {
  financeProjectId: string;
  fyYear: string;
  classification: BacklogClassification;
  budgetRevenue: number;
  notes?: string | null;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const user = await requireFinanceAccess();
  try {
    const existing = await prisma.backlogBudget.findUnique({
      where: { financeProjectId_fyYear: { financeProjectId: input.financeProjectId, fyYear: input.fyYear } },
      select: { id: true, status: true },
    });

    if (existing && existing.status === 'LOCKED') {
      return { ok: false, error: 'Record is locked. Use the Adjust action to override.' };
    }

    const record = await prisma.backlogBudget.upsert({
      where: { financeProjectId_fyYear: { financeProjectId: input.financeProjectId, fyYear: input.fyYear } },
      update: {
        classification: input.classification,
        budgetRevenue: input.budgetRevenue,
        notes: input.notes ?? null,
      },
      create: {
        organisationId: user.organisationId,
        financeProjectId: input.financeProjectId,
        fyYear: input.fyYear,
        classification: input.classification,
        budgetRevenue: input.budgetRevenue,
        notes: input.notes ?? null,
      },
      select: { id: true },
    });

    await createAuditLog({
      userId: user.id,
      action: existing ? 'BACKLOG_BUDGET_UPDATED' : 'BACKLOG_BUDGET_CREATED',
      entity: 'BacklogBudget',
      entityId: record.id,
      detail: { fy_year: input.fyYear, classification: input.classification, budget_revenue: input.budgetRevenue },
    });

    return { ok: true, id: record.id };
  } catch (e) {
    console.error('[backlog] upsertBacklogBudget error:', e);
    return { ok: false, error: 'Failed to save backlog record.' };
  }
}

export async function lockFYBacklog(fyYear: string): Promise<{ ok: boolean; lockedCount?: number; error?: string }> {
  const user = await requireDirector();
  try {
    const now = new Date();
    const result = await prisma.backlogBudget.updateMany({
      where: { organisationId: user.organisationId, fyYear, status: 'DRAFT' },
      data: { status: 'LOCKED', lockedAt: now, lockedBy: user.id },
    });

    // Get totals for audit log
    const totals = await prisma.backlogBudget.groupBy({
      by: ['classification'],
      where: { organisationId: user.organisationId, fyYear },
      _sum: { budgetRevenue: true },
    });

    const awardedTotal = totals.find((t) => t.classification === 'AWARDED')?._sum.budgetRevenue?.toString() ?? '0';
    const backlogTotal = totals.find((t) => t.classification === 'BACKLOG')?._sum.budgetRevenue?.toString() ?? '0';

    await createAuditLog({
      userId: user.id,
      action: 'BACKLOG_BUDGET_LOCKED',
      entity: 'BacklogBudget',
      detail: { fy_year: fyYear, locked_count: result.count, awarded_total: awardedTotal, backlog_total: backlogTotal },
    });

    return { ok: true, lockedCount: result.count };
  } catch (e) {
    console.error('[backlog] lockFYBacklog error:', e);
    return { ok: false, error: 'Failed to lock FY backlog.' };
  }
}

export async function adjustBacklogBudget(input: {
  financeProjectId: string;
  fyYear: string;
  classification: BacklogClassification;
  budgetRevenue: number;
  adjustmentReason: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  if (input.adjustmentReason.trim().length < 10) {
    return { ok: false, error: 'Reason must be at least 10 characters.' };
  }
  try {
    const existing = await prisma.backlogBudget.findUnique({
      where: { financeProjectId_fyYear: { financeProjectId: input.financeProjectId, fyYear: input.fyYear } },
    });
    if (!existing) return { ok: false, error: 'Record not found.' };

    await prisma.backlogBudget.update({
      where: { financeProjectId_fyYear: { financeProjectId: input.financeProjectId, fyYear: input.fyYear } },
      data: {
        status: 'ADJUSTED',
        classification: input.classification,
        budgetRevenue: input.budgetRevenue,
        adjustmentReason: input.adjustmentReason,
        lastAdjustedAt: new Date(),
        lastAdjustedBy: user.id,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: 'BACKLOG_BUDGET_ADJUSTED',
      entity: 'BacklogBudget',
      entityId: existing.id,
      detail: {
        fy_year: input.fyYear,
        before: { classification: existing.classification, budget_revenue: existing.budgetRevenue.toString() },
        after: { classification: input.classification, budget_revenue: input.budgetRevenue },
        reason: input.adjustmentReason,
      },
    });

    return { ok: true };
  } catch (e) {
    console.error('[backlog] adjustBacklogBudget error:', e);
    return { ok: false, error: 'Failed to save adjustment.' };
  }
}

export async function getProjectCATTrend(financeProjectId: string): Promise<{
  ok: boolean;
  trend?: CATTrendRow[];
  keyFigures?: {
    marginToEarn: string;
    nettRetention: string;
    nettCashFlow: string;
    billingLessCost: string;
    practicalCompletion: string | null;
    asAtDate: string;
  };
  error?: string;
}> {
  await requireFinanceAccess();
  try {
    const snapshots = await prisma.financeProjectSnapshot.findMany({
      where: { financeProjectId },
      orderBy: { asAtDate: 'desc' },
      take: 3,
      select: {
        asAtDate: true,
        forecastContract: true,
        totalCost: true,
        forecastMargin: true,
        forecastMarginPct: true,
        roAdjust: true,
        marginToEarn: true,
        nettRetention: true,
        nettCashFlow: true,
        billingLessCost: true,
        practicalCompletion: true,
      },
    });

    const trend: CATTrendRow[] = snapshots.map((s) => ({
      asAtDate: s.asAtDate.toISOString(),
      forecastContract: s.forecastContract.toString(),
      totalCost: s.totalCost.toString(),
      forecastMargin: s.forecastMargin.toString(),
      forecastMarginPct: s.forecastMarginPct.toString(),
      roAdjust: s.roAdjust.toString(),
    }));

    const latest = snapshots[0];
    const keyFigures = latest
      ? {
          marginToEarn: latest.marginToEarn.toString(),
          nettRetention: latest.nettRetention.toString(),
          nettCashFlow: latest.nettCashFlow.toString(),
          billingLessCost: latest.billingLessCost.toString(),
          practicalCompletion: latest.practicalCompletion?.toISOString() ?? null,
          asAtDate: latest.asAtDate.toISOString(),
        }
      : undefined;

    return { ok: true, trend, keyFigures };
  } catch (e) {
    console.error('[backlog] getProjectCATTrend error:', e);
    return { ok: false, error: 'Failed to load CAT trend.' };
  }
}
