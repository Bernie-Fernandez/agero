'use server';

import { requireDirector } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import type { BudgetLineSource, LeadStage } from '@agero/db';
import { fyLabels, budgetMonths, defaultBudgetYear } from './fy';

// ─── Open CRM opportunity stages (Lead) ────────────────────────────────────────

const CLOSED_LEAD_STAGES: LeadStage[] = [
  'CLOSED_WON', 'CLOSED_LOST', 'DEAD', 'WITHDRAWN',
  'PURSUIT_UNSUCCESSFUL', 'SUBMISSION_DECLINED', 'SUBMISSION_WITHDRAWN',
];

// ─── Types ─────────────────────────────────────────────────────────────────────

export type BudgetMonthCol = { month: string; label: string };

export type BacklogLineRow = {
  id: string;
  sourceCatJobNo: string | null;
  projectName: string;
  carriedRevenue: number;
  carriedProfit: number;
  wipCarryIn: number;
  isManualAdjustment: boolean;
  notes: string | null;
};

export type PlannedWorkLineRow = {
  id: string;
  source: BudgetLineSource;
  crmOpportunityId: string | null;
  opportunityName: string;
  contractValue: number;
  forecastMarginPct: number; // stored as percentage
  revenueCurveId: string | null;
  backlogNextRevenue: number;
  backlogNextProfit: number;
  spread: Record<string, { amount: number; locked: boolean }>; // keyed by month ISO
};

export type CrmOpportunityRow = {
  leadId: string;
  hubspotDealId: string;
  name: string;
  contractValue: number;
  marginPct: number;
};

export type PlannedWorkBudgetData = {
  id: string;
  financialYear: number;
  status: 'DRAFT' | 'LOCKED';
  currentLabel: string;
  nextLabel: string;
  editable: boolean;
  lockedAccountant: string | null;
  wipSignedOff: boolean;
  lockedAt: string | null;
  months: BudgetMonthCol[];
  backlogLines: BacklogLineRow[];
  plannedWorkLines: PlannedWorkLineRow[];
  availableYears: number[];
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function n(v: unknown): number { return v == null ? 0 : Number(v); }

async function getOrCreateBudget(orgId: string, financialYear: number) {
  let budget = await prisma.plannedWorkBudget.findUnique({
    where: { organisationId_financialYear: { organisationId: orgId, financialYear } },
  });
  if (!budget) {
    budget = await prisma.plannedWorkBudget.create({
      data: { organisationId: orgId, financialYear, status: 'DRAFT' },
    });
  }
  return budget;
}

/** Recompute carry-out (revenue + profit landing in FY[next]) for a planned-work line. */
async function recomputeCarryOut(lineId: string) {
  const line = await prisma.budgetPlannedWorkLine.findUnique({
    where: { id: lineId },
    include: { monthlySpread: true },
  });
  if (!line) return;
  const contract = n(line.contractValue);
  const spreadTotal = line.monthlySpread.reduce((s, m) => s + n(m.revenueAmount), 0);
  const carryRevenue = Math.max(0, contract - spreadTotal);
  const carryProfit = carryRevenue * (n(line.forecastMarginPct) / 100);
  await prisma.budgetPlannedWorkLine.update({
    where: { id: lineId },
    data: {
      backlogNextRevenue: carryRevenue,
      backlogNextProfit: carryProfit,
    },
  });
}

// ─── Read ────────────────────────────────────────────────────────────────────────

export async function getBudgetData(financialYear?: number): Promise<{ ok: boolean; data?: PlannedWorkBudgetData; error?: string }> {
  const user = await requireDirector();
  try {
    const fy = financialYear ?? defaultBudgetYear();
    const budget = await getOrCreateBudget(user.organisationId, fy);

    const [backlogLines, plannedWorkLines] = await Promise.all([
      prisma.budgetBacklogLine.findMany({
        where: { plannedWorkBudgetId: budget.id },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.budgetPlannedWorkLine.findMany({
        where: { plannedWorkBudgetId: budget.id },
        orderBy: { createdAt: 'asc' },
        include: { monthlySpread: true },
      }),
    ]);

    const labels = fyLabels(fy);
    const months = budgetMonths(fy);

    const data: PlannedWorkBudgetData = {
      id: budget.id,
      financialYear: fy,
      status: budget.status as 'DRAFT' | 'LOCKED',
      currentLabel: labels.current,
      nextLabel: labels.next,
      editable: budget.status === 'DRAFT',
      lockedAccountant: budget.lockedAccountant,
      wipSignedOff: budget.wipSignedOff,
      lockedAt: budget.lockedAt ? budget.lockedAt.toISOString() : null,
      months,
      backlogLines: backlogLines.map((b) => ({
        id: b.id,
        sourceCatJobNo: b.sourceCatJobNo,
        projectName: b.projectName,
        carriedRevenue: n(b.carriedRevenue),
        carriedProfit: n(b.carriedProfit),
        wipCarryIn: n(b.wipCarryIn),
        isManualAdjustment: b.isManualAdjustment,
        notes: b.notes,
      })),
      plannedWorkLines: plannedWorkLines.map((p) => {
        const spread: Record<string, { amount: number; locked: boolean }> = {};
        for (const cell of p.monthlySpread) {
          spread[cell.month.toISOString().slice(0, 10)] = { amount: n(cell.revenueAmount), locked: cell.isLockedCell };
        }
        return {
          id: p.id,
          source: p.source,
          crmOpportunityId: p.crmOpportunityId,
          opportunityName: p.opportunityName,
          contractValue: n(p.contractValue),
          forecastMarginPct: n(p.forecastMarginPct),
          revenueCurveId: p.revenueCurveId,
          backlogNextRevenue: n(p.backlogNextRevenue),
          backlogNextProfit: n(p.backlogNextProfit),
          spread,
        };
      }),
      availableYears: [fy - 1, fy, fy + 1],
    };

    return { ok: true, data };
  } catch (e) {
    console.error('[planned-work-budget] getBudgetData error:', e);
    return { ok: false, error: 'Failed to load planned work budget.' };
  }
}

// ─── Guard: budget must be editable (DRAFT) ─────────────────────────────────────

async function assertEditable(orgId: string, budgetId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const budget = await prisma.plannedWorkBudget.findFirst({
    where: { id: budgetId, organisationId: orgId },
    select: { status: true },
  });
  if (!budget) return { ok: false, error: 'Budget not found.' };
  if (budget.status === 'LOCKED') return { ok: false, error: 'Budget is locked. Use Super Override to make changes.' };
  return { ok: true };
}

// ─── Section 1 — Backlog carry-in ───────────────────────────────────────────────

export async function proposeBacklogLines(financialYear: number): Promise<{ ok: boolean; added?: number; error?: string }> {
  const user = await requireDirector();
  try {
    const budget = await getOrCreateBudget(user.organisationId, financialYear);
    const guard = await assertEditable(user.organisationId, budget.id);
    if (!guard.ok) return guard;

    // Secured jobs = AWARDED / BACKLOG finance projects, with their latest snapshot.
    const projects = await prisma.financeProject.findMany({
      where: { organisationId: user.organisationId, deletedAt: null, status: { in: ['AWARDED', 'BACKLOG'] } },
      include: { snapshots: { orderBy: { asAtDate: 'desc' }, take: 1 } },
      orderBy: { jobNumber: 'asc' },
    });

    // Existing rows (by source CAT job no) — never overwrite manual adjustments.
    const existing = await prisma.budgetBacklogLine.findMany({
      where: { plannedWorkBudgetId: budget.id },
      select: { sourceCatJobNo: true },
    });
    const existingJobs = new Set(existing.map((e) => e.sourceCatJobNo).filter(Boolean));

    const toCreate = projects
      .filter((p) => !existingJobs.has(p.jobNumber))
      .map((p) => {
        const snap = p.snapshots[0];
        const forecastContract = snap ? n(snap.forecastContract) : n(p.forecastContractValue);
        const claimTotal = snap ? n(snap.claimTotal) : n(p.claimTotal);
        const carriedRevenue = Math.max(0, forecastContract - claimTotal); // remaining unbilled revenue
        const carriedProfit = snap ? n(snap.marginToEarn) : n(p.marginToEarn); // first-pass profit to recognise
        const wipCarryIn = snap ? n(snap.wip) : n(p.wip);                       // critical first-pass WIP carry-in
        return {
          plannedWorkBudgetId: budget.id,
          sourceCatJobNo: p.jobNumber,
          projectName: p.projectName,
          carriedRevenue,
          carriedProfit,
          wipCarryIn,
          isManualAdjustment: false,
        };
      });

    if (toCreate.length > 0) {
      await prisma.budgetBacklogLine.createMany({ data: toCreate });
    }

    await createAuditLog({
      userId: user.id,
      action: 'PLANNED_BUDGET_BACKLOG_PROPOSED',
      entity: 'PlannedWorkBudget',
      entityId: budget.id,
      detail: { financial_year: financialYear, added: toCreate.length },
    });

    return { ok: true, added: toCreate.length };
  } catch (e) {
    console.error('[planned-work-budget] proposeBacklogLines error:', e);
    return { ok: false, error: 'Failed to propose backlog rows.' };
  }
}

export async function addBacklogLine(financialYear: number, projectName: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  try {
    const budget = await getOrCreateBudget(user.organisationId, financialYear);
    const guard = await assertEditable(user.organisationId, budget.id);
    if (!guard.ok) return guard;
    await prisma.budgetBacklogLine.create({
      data: { plannedWorkBudgetId: budget.id, projectName: projectName.trim() || 'New backlog row', isManualAdjustment: true },
    });
    return { ok: true };
  } catch (e) {
    console.error('[planned-work-budget] addBacklogLine error:', e);
    return { ok: false, error: 'Failed to add backlog row.' };
  }
}

export async function updateBacklogLine(input: {
  lineId: string;
  projectName?: string;
  carriedRevenue?: number;
  carriedProfit?: number;
  wipCarryIn?: number;
  notes?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  try {
    const line = await prisma.budgetBacklogLine.findUnique({
      where: { id: input.lineId },
      include: { plannedWorkBudget: { select: { organisationId: true, status: true } } },
    });
    if (!line || line.plannedWorkBudget.organisationId !== user.organisationId) return { ok: false, error: 'Row not found.' };
    if (line.plannedWorkBudget.status === 'LOCKED') return { ok: false, error: 'Budget is locked.' };

    await prisma.budgetBacklogLine.update({
      where: { id: input.lineId },
      data: {
        projectName: input.projectName ?? undefined,
        carriedRevenue: input.carriedRevenue ?? undefined,
        carriedProfit: input.carriedProfit ?? undefined,
        wipCarryIn: input.wipCarryIn ?? undefined,
        notes: input.notes === undefined ? undefined : input.notes,
        isManualAdjustment: true, // any edit marks it hand-adjusted
      },
    });
    return { ok: true };
  } catch (e) {
    console.error('[planned-work-budget] updateBacklogLine error:', e);
    return { ok: false, error: 'Failed to save row.' };
  }
}

export async function deleteBacklogLine(lineId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  try {
    const line = await prisma.budgetBacklogLine.findUnique({
      where: { id: lineId },
      include: { plannedWorkBudget: { select: { organisationId: true, status: true } } },
    });
    if (!line || line.plannedWorkBudget.organisationId !== user.organisationId) return { ok: false, error: 'Row not found.' };
    if (line.plannedWorkBudget.status === 'LOCKED') return { ok: false, error: 'Budget is locked.' };
    await prisma.budgetBacklogLine.delete({ where: { id: lineId } });
    return { ok: true };
  } catch (e) {
    console.error('[planned-work-budget] deleteBacklogLine error:', e);
    return { ok: false, error: 'Failed to delete row.' };
  }
}

// ─── Section 2 — Planned work (carry-out) ───────────────────────────────────────

export async function listOpenCrmOpportunities(): Promise<{ ok: boolean; rows?: CrmOpportunityRow[]; error?: string }> {
  const user = await requireDirector();
  try {
    const leads = await prisma.lead.findMany({
      where: {
        organisationId: user.organisationId,
        deletedAt: null,
        stage: { notIn: CLOSED_LEAD_STAGES },
      },
      orderBy: { leadName: 'asc' },
      select: { id: true, hubspotDealId: true, leadName: true, contractValue: true, entryGpPct: true },
    });
    return {
      ok: true,
      rows: leads.map((l) => ({
        leadId: l.id,
        hubspotDealId: l.hubspotDealId,
        name: l.leadName,
        contractValue: n(l.contractValue),
        marginPct: n(l.entryGpPct) * 100, // entry_gp_pct stored as fraction → percentage
      })),
    };
  } catch (e) {
    console.error('[planned-work-budget] listOpenCrmOpportunities error:', e);
    return { ok: false, error: 'Failed to load CRM opportunities.' };
  }
}

export async function addPlannedWorkLineFromCrm(financialYear: number, leadId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  try {
    const budget = await getOrCreateBudget(user.organisationId, financialYear);
    const guard = await assertEditable(user.organisationId, budget.id);
    if (!guard.ok) return guard;
    const lead = await prisma.lead.findFirst({ where: { id: leadId, organisationId: user.organisationId } });
    if (!lead) return { ok: false, error: 'CRM opportunity not found.' };

    const line = await prisma.budgetPlannedWorkLine.create({
      data: {
        plannedWorkBudgetId: budget.id,
        source: 'CRM',
        crmOpportunityId: lead.hubspotDealId,
        opportunityName: lead.leadName,
        contractValue: n(lead.contractValue),
        forecastMarginPct: n(lead.entryGpPct) * 100,
      },
    });
    await recomputeCarryOut(line.id);
    return { ok: true };
  } catch (e) {
    console.error('[planned-work-budget] addPlannedWorkLineFromCrm error:', e);
    return { ok: false, error: 'Failed to add CRM opportunity.' };
  }
}

export async function addPlaceholderLine(financialYear: number, input: {
  opportunityName: string;
  contractValue: number;
  forecastMarginPct: number;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  try {
    const budget = await getOrCreateBudget(user.organisationId, financialYear);
    const guard = await assertEditable(user.organisationId, budget.id);
    if (!guard.ok) return guard;
    const line = await prisma.budgetPlannedWorkLine.create({
      data: {
        plannedWorkBudgetId: budget.id,
        source: 'PLACEHOLDER',
        opportunityName: input.opportunityName.trim() || 'New placeholder',
        contractValue: input.contractValue,
        forecastMarginPct: input.forecastMarginPct,
      },
    });
    await recomputeCarryOut(line.id);
    return { ok: true };
  } catch (e) {
    console.error('[planned-work-budget] addPlaceholderLine error:', e);
    return { ok: false, error: 'Failed to add placeholder.' };
  }
}

async function loadEditablePlannedLine(orgId: string, lineId: string) {
  const line = await prisma.budgetPlannedWorkLine.findUnique({
    where: { id: lineId },
    include: { plannedWorkBudget: { select: { organisationId: true, status: true } } },
  });
  if (!line || line.plannedWorkBudget.organisationId !== orgId) return { error: 'Row not found.' as const };
  if (line.plannedWorkBudget.status === 'LOCKED') return { error: 'Budget is locked.' as const };
  return { line };
}

export async function updatePlannedWorkLine(input: {
  lineId: string;
  opportunityName?: string;
  contractValue?: number;
  forecastMarginPct?: number;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  try {
    const res = await loadEditablePlannedLine(user.organisationId, input.lineId);
    if ('error' in res) return { ok: false, error: res.error };
    await prisma.budgetPlannedWorkLine.update({
      where: { id: input.lineId },
      data: {
        opportunityName: input.opportunityName ?? undefined,
        contractValue: input.contractValue ?? undefined,
        forecastMarginPct: input.forecastMarginPct ?? undefined,
      },
    });
    await recomputeCarryOut(input.lineId);
    return { ok: true };
  } catch (e) {
    console.error('[planned-work-budget] updatePlannedWorkLine error:', e);
    return { ok: false, error: 'Failed to save row.' };
  }
}

export async function deletePlannedWorkLine(lineId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  try {
    const res = await loadEditablePlannedLine(user.organisationId, lineId);
    if ('error' in res) return { ok: false, error: res.error };
    await prisma.budgetPlannedWorkLine.delete({ where: { id: lineId } });
    return { ok: true };
  } catch (e) {
    console.error('[planned-work-budget] deletePlannedWorkLine error:', e);
    return { ok: false, error: 'Failed to delete row.' };
  }
}

export async function linkPlaceholderToCrm(lineId: string, leadId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  try {
    const res = await loadEditablePlannedLine(user.organisationId, lineId);
    if ('error' in res) return { ok: false, error: res.error };
    const lead = await prisma.lead.findFirst({ where: { id: leadId, organisationId: user.organisationId } });
    if (!lead) return { ok: false, error: 'CRM opportunity not found.' };
    await prisma.budgetPlannedWorkLine.update({
      where: { id: lineId },
      data: { source: 'CRM', crmOpportunityId: lead.hubspotDealId, opportunityName: lead.leadName },
    });
    return { ok: true };
  } catch (e) {
    console.error('[planned-work-budget] linkPlaceholderToCrm error:', e);
    return { ok: false, error: 'Failed to link opportunity.' };
  }
}

// ─── Spread / distribute ────────────────────────────────────────────────────────

export async function distributeSpread(lineId: string, curveId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  try {
    const res = await loadEditablePlannedLine(user.organisationId, lineId);
    if ('error' in res) return { ok: false, error: res.error };
    const line = res.line;

    const curve = await prisma.revenueCurve.findFirst({ where: { id: curveId, organisationId: user.organisationId } });
    if (!curve) return { ok: false, error: 'Revenue curve not found.' };
    const weights = (curve.weights as number[]).slice(0, 12);
    const weightSum = weights.reduce((a, b) => a + b, 0) || 1;

    const fy = (await prisma.plannedWorkBudget.findUnique({ where: { id: line.plannedWorkBudgetId }, select: { financialYear: true } }))!.financialYear;
    const months = budgetMonths(fy);
    const contract = n(line.contractValue);

    // Preserve locked cells; distribute the remainder across unlocked months by curve weight.
    const existing = await prisma.budgetMonthlySpread.findMany({ where: { plannedWorkLineId: lineId } });
    const lockedByMonth = new Map(existing.filter((e) => e.isLockedCell).map((e) => [e.month.toISOString().slice(0, 10), n(e.revenueAmount)]));
    const lockedSum = [...lockedByMonth.values()].reduce((a, b) => a + b, 0);
    const remaining = Math.max(0, contract - lockedSum);

    const unlockedWeightSum = months.reduce((s, m, i) => (lockedByMonth.has(m.month) ? s : s + (weights[i] ?? 0)), 0) || 1;

    for (let i = 0; i < months.length; i++) {
      const monthIso = months[i].month;
      const monthDate = new Date(months[i].month + 'T00:00:00.000Z');
      if (lockedByMonth.has(monthIso)) continue; // keep locked cells
      const w = weights[i] ?? 0;
      const amount = lockedSum > 0
        ? remaining * (w / unlockedWeightSum)
        : contract * (w / weightSum);
      await prisma.budgetMonthlySpread.upsert({
        where: { plannedWorkLineId_month: { plannedWorkLineId: lineId, month: monthDate } },
        update: { revenueAmount: amount },
        create: { plannedWorkLineId: lineId, month: monthDate, revenueAmount: amount, isLockedCell: false },
      });
    }

    await prisma.budgetPlannedWorkLine.update({ where: { id: lineId }, data: { revenueCurveId: curveId } });
    await recomputeCarryOut(lineId);
    return { ok: true };
  } catch (e) {
    console.error('[planned-work-budget] distributeSpread error:', e);
    return { ok: false, error: 'Failed to distribute spread.' };
  }
}

export async function updateSpreadCell(input: {
  lineId: string;
  month: string; // ISO date first-of-month
  amount: number;
  locked: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  try {
    const res = await loadEditablePlannedLine(user.organisationId, input.lineId);
    if ('error' in res) return { ok: false, error: res.error };
    const monthDate = new Date(input.month + 'T00:00:00.000Z');
    await prisma.budgetMonthlySpread.upsert({
      where: { plannedWorkLineId_month: { plannedWorkLineId: input.lineId, month: monthDate } },
      update: { revenueAmount: input.amount, isLockedCell: input.locked },
      create: { plannedWorkLineId: input.lineId, month: monthDate, revenueAmount: input.amount, isLockedCell: input.locked },
    });
    await recomputeCarryOut(input.lineId);
    return { ok: true };
  } catch (e) {
    console.error('[planned-work-budget] updateSpreadCell error:', e);
    return { ok: false, error: 'Failed to save cell.' };
  }
}

// ─── Lock / Super override ──────────────────────────────────────────────────────

export async function lockBudget(input: {
  financialYear: number;
  accountantName: string;
  wipSignedOff: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  if (!input.wipSignedOff) return { ok: false, error: 'WIP sign-off is required to lock the budget.' };
  if (input.accountantName.trim().length < 2) return { ok: false, error: 'Accountant name is required for the co-sign.' };
  try {
    const budget = await getOrCreateBudget(user.organisationId, input.financialYear);
    if (budget.status === 'LOCKED') return { ok: false, error: 'Budget is already locked.' };

    await prisma.plannedWorkBudget.update({
      where: { id: budget.id },
      data: {
        status: 'LOCKED',
        lockedById: user.id,
        lockedAccountant: input.accountantName.trim(),
        wipSignedOff: true,
        lockedAt: new Date(),
      },
    });

    await createAuditLog({
      userId: user.id,
      action: 'PLANNED_BUDGET_LOCKED',
      entity: 'PlannedWorkBudget',
      entityId: budget.id,
      detail: { financial_year: input.financialYear, accountant: input.accountantName.trim(), wip_signed_off: true },
    });

    return { ok: true };
  } catch (e) {
    console.error('[planned-work-budget] lockBudget error:', e);
    return { ok: false, error: 'Failed to lock budget.' };
  }
}

export async function superOverride(input: {
  financialYear: number;
  accountantName: string;
  reason: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  if (input.reason.trim().length < 20) return { ok: false, error: 'A written reason of at least 20 characters is required.' };
  if (input.accountantName.trim().length < 2) return { ok: false, error: 'Accountant co-sign name is required.' };
  try {
    const budget = await prisma.plannedWorkBudget.findFirst({
      where: { organisationId: user.organisationId, financialYear: input.financialYear },
      include: { backlogLines: true, plannedWorkLines: { include: { monthlySpread: true } } },
    });
    if (!budget) return { ok: false, error: 'Budget not found.' };
    if (budget.status !== 'LOCKED') return { ok: false, error: 'Super override only applies to a locked budget.' };

    const beforeJson = JSON.stringify(budget);

    await prisma.budgetOverrideLog.create({
      data: {
        plannedWorkBudgetId: budget.id,
        overriddenById: user.id,
        accountantName: input.accountantName.trim(),
        reason: input.reason.trim(),
        beforeJson,
        afterJson: null,
      },
    });

    // Re-open for the specific edit. WIP sign-off must be re-confirmed at next lock.
    await prisma.plannedWorkBudget.update({
      where: { id: budget.id },
      data: { status: 'DRAFT', wipSignedOff: false, lockedAt: null },
    });

    await createAuditLog({
      userId: user.id,
      action: 'PLANNED_BUDGET_SUPER_OVERRIDE',
      entity: 'PlannedWorkBudget',
      entityId: budget.id,
      detail: { financial_year: input.financialYear, accountant: input.accountantName.trim(), reason: input.reason.trim() },
    });

    return { ok: true };
  } catch (e) {
    console.error('[planned-work-budget] superOverride error:', e);
    return { ok: false, error: 'Failed to record override.' };
  }
}
