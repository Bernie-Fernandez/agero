'use server';

import { requireFinanceAccess } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import type { BacklogClassification } from '@agero/db';

// ─── Month keys ──────────────────────────────────────────────────────────────

export const MONTH_KEYS_FY27 = [
  'jul26', 'aug26', 'sep26', 'oct26', 'nov26', 'dec26',
  'jan27', 'feb27', 'mar27', 'apr27', 'may27', 'jun27',
] as const;

export const MONTH_KEYS_FY28 = [
  'jul27b', 'aug27b', 'sep27b', 'oct27b', 'nov27b', 'dec27b',
  'jan28', 'feb28', 'mar28', 'apr28', 'may28', 'jun28',
] as const;

export const ALL_MONTH_KEYS = [...MONTH_KEYS_FY27, ...MONTH_KEYS_FY28] as const;
export type MonthKey = typeof ALL_MONTH_KEYS[number];

export type MonthlyData = Partial<Record<MonthKey, number>>;

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProjectRevenueBudgetRow = {
  id: string;
  financeProjectId: string;
  jobNumber: string;
  projectName: string;
  fyYear: string;
  classification: BacklogClassification;
  budgetRevenue: string | null; // from BacklogBudget for variance check
  monthly: Record<MonthKey, string>;
  notes: string | null;
};

export type UnsecuredRevenueBudgetRow = {
  id: string;
  leadId: string;
  leadName: string;
  leadValue: string;
  stage: string;
  fyYear: string;
  monthly: Record<MonthKey, string>;
  notes: string | null;
};

export type QualifyingLead = {
  id: string;
  leadName: string;
  contractValue: string | null;
  stage: string;
};

export type BudgetTotals = Record<MonthKey, string>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const QUALIFYING_STAGES = [
  'DEVELOPING' as const,
  'QUALIFIED' as const,
  'SUBMISSION_IN_PROGRESS' as const,
  'SUBMISSION_AWAITING' as const,
  'INTENT_TO_NEGOTIATE' as const,
];

function extractMonthly(record: Record<string, unknown>): Record<MonthKey, string> {
  const out: Record<string, string> = {};
  for (const key of ALL_MONTH_KEYS) {
    const val = record[key];
    out[key] = val != null ? String(val) : '0';
  }
  return out as Record<MonthKey, string>;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function getProjectRevenueBudgets(fyYear: string): Promise<{
  ok: boolean;
  rows?: ProjectRevenueBudgetRow[];
  error?: string;
}> {
  const user = await requireFinanceAccess();
  try {
    const projects = await prisma.financeProject.findMany({
      where: {
        organisationId: user.organisationId,
        deletedAt: null,
        backlogBudgets: { some: { fyYear, classification: { in: ['AWARDED', 'BACKLOG'] } } },
      },
      orderBy: [{ jobNumber: 'asc' }],
      select: {
        id: true,
        jobNumber: true,
        projectName: true,
        backlogBudgets: {
          where: { fyYear },
          take: 1,
          select: { classification: true, budgetRevenue: true },
        },
        projectRevenueBudgets: {
          where: { fyYear },
          take: 1,
        },
      },
    });

    const rows: ProjectRevenueBudgetRow[] = projects.map((p) => {
      const bb = p.backlogBudgets[0];
      const prb = p.projectRevenueBudgets[0];
      const serialized: Record<string, unknown> = prb ? JSON.parse(JSON.stringify(prb)) : {};
      return {
        id: prb?.id ?? '',
        financeProjectId: p.id,
        jobNumber: p.jobNumber,
        projectName: p.projectName,
        fyYear,
        classification: bb?.classification ?? 'AWARDED',
        budgetRevenue: bb?.budgetRevenue?.toString() ?? null,
        monthly: extractMonthly(serialized),
        notes: prb?.notes ?? null,
      };
    });

    return { ok: true, rows };
  } catch (e) {
    console.error('[revenue-budget] getProjectRevenueBudgets error:', e);
    return { ok: false, error: 'Failed to load project revenue budgets.' };
  }
}

export async function upsertProjectRevenueBudget(input: {
  financeProjectId: string;
  fyYear: string;
  classification: BacklogClassification;
  monthlyData: MonthlyData;
  notes?: string | null;
  distributed?: boolean;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const user = await requireFinanceAccess();
  try {
    const monthFields: Record<string, number> = {};
    for (const key of ALL_MONTH_KEYS) {
      if (key in input.monthlyData) {
        monthFields[key] = input.monthlyData[key] ?? 0;
      }
    }

    const record = await prisma.projectRevenueBudget.upsert({
      where: { financeProjectId_fyYear: { financeProjectId: input.financeProjectId, fyYear: input.fyYear } },
      update: { classification: input.classification, notes: input.notes ?? undefined, ...monthFields },
      create: {
        organisationId: user.organisationId,
        financeProjectId: input.financeProjectId,
        fyYear: input.fyYear,
        classification: input.classification,
        notes: input.notes ?? null,
        ...monthFields,
      },
      select: { id: true },
    });

    await createAuditLog({
      userId: user.id,
      action: input.distributed ? 'REVENUE_BUDGET_DISTRIBUTED' : 'REVENUE_BUDGET_UPDATED',
      entity: 'ProjectRevenueBudget',
      entityId: record.id,
      detail: { fy_year: input.fyYear, finance_project_id: input.financeProjectId, months: input.monthlyData },
    });

    return { ok: true, id: record.id };
  } catch (e) {
    console.error('[revenue-budget] upsertProjectRevenueBudget error:', e);
    return { ok: false, error: 'Failed to save project revenue budget.' };
  }
}

export async function getUnsecuredRevenueBudgets(fyYear: string): Promise<{
  ok: boolean;
  rows?: UnsecuredRevenueBudgetRow[];
  error?: string;
}> {
  const user = await requireFinanceAccess();
  try {
    const records = await prisma.unsecuredRevenueBudget.findMany({
      where: { organisationId: user.organisationId, fyYear, deletedAt: null },
      orderBy: [{ leadName: 'asc' }],
    });

    // Fetch CRM lead stage info for display
    const leadIds = records.map((r) => r.leadId);
    const leads = leadIds.length > 0
      ? await prisma.lead.findMany({
          where: { id: { in: leadIds } },
          select: { id: true, stage: true },
        })
      : [];
    const stageMap = new Map(leads.map((l) => [l.id, l.stage as string]));

    const serialized = JSON.parse(JSON.stringify(records));
    const rows: UnsecuredRevenueBudgetRow[] = serialized.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      leadId: r.leadId as string,
      leadName: r.leadName as string,
      leadValue: String(r.leadValue ?? '0'),
      stage: stageMap.get(r.leadId as string) ?? 'UNKNOWN',
      fyYear,
      monthly: extractMonthly(r),
      notes: (r.notes as string | null) ?? null,
    }));

    // Sort by stage priority (highest first)
    const stagePriority = ['INTENT_TO_NEGOTIATE', 'SUBMISSION_AWAITING', 'SUBMISSION_IN_PROGRESS', 'QUALIFIED', 'DEVELOPING'];
    rows.sort((a, b) => stagePriority.indexOf(a.stage) - stagePriority.indexOf(b.stage));

    return { ok: true, rows };
  } catch (e) {
    console.error('[revenue-budget] getUnsecuredRevenueBudgets error:', e);
    return { ok: false, error: 'Failed to load unsecured revenue budgets.' };
  }
}

export async function upsertUnsecuredRevenueBudget(input: {
  leadId: string;
  leadName: string;
  leadValue: number;
  fyYear: string;
  monthlyData: MonthlyData;
  notes?: string | null;
  distributed?: boolean;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const user = await requireFinanceAccess();
  try {
    const monthFields: Record<string, number> = {};
    for (const key of ALL_MONTH_KEYS) {
      if (key in input.monthlyData) {
        monthFields[key] = input.monthlyData[key] ?? 0;
      }
    }

    const record = await prisma.unsecuredRevenueBudget.upsert({
      where: { leadId_fyYear: { leadId: input.leadId, fyYear: input.fyYear } },
      update: { leadName: input.leadName, leadValue: input.leadValue, notes: input.notes ?? undefined, deletedAt: null, ...monthFields },
      create: {
        organisationId: user.organisationId,
        leadId: input.leadId,
        leadName: input.leadName,
        leadValue: input.leadValue,
        fyYear: input.fyYear,
        notes: input.notes ?? null,
        ...monthFields,
      },
      select: { id: true },
    });

    await createAuditLog({
      userId: user.id,
      action: input.distributed ? 'REVENUE_BUDGET_DISTRIBUTED' : 'REVENUE_BUDGET_UPDATED',
      entity: 'UnsecuredRevenueBudget',
      entityId: record.id,
      detail: { fy_year: input.fyYear, lead_id: input.leadId, lead_name: input.leadName, months: input.monthlyData },
    });

    return { ok: true, id: record.id };
  } catch (e) {
    console.error('[revenue-budget] upsertUnsecuredRevenueBudget error:', e);
    return { ok: false, error: 'Failed to save unsecured revenue budget.' };
  }
}

export async function addUnsecuredLead(input: {
  leadId: string;
  fyYear: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireFinanceAccess();
  try {
    const lead = await prisma.lead.findFirst({
      where: { id: input.leadId, organisationId: user.organisationId, deletedAt: null },
      select: { id: true, leadName: true, contractValue: true },
    });
    if (!lead) return { ok: false, error: 'Lead not found.' };

    const record = await prisma.unsecuredRevenueBudget.upsert({
      where: { leadId_fyYear: { leadId: input.leadId, fyYear: input.fyYear } },
      update: { deletedAt: null, leadName: lead.leadName, leadValue: lead.contractValue ?? 0 },
      create: {
        organisationId: user.organisationId,
        leadId: input.leadId,
        leadName: lead.leadName,
        leadValue: lead.contractValue ?? 0,
        fyYear: input.fyYear,
      },
      select: { id: true },
    });

    await createAuditLog({
      userId: user.id,
      action: 'UNSECURED_BUDGET_LEAD_ADDED',
      entity: 'UnsecuredRevenueBudget',
      entityId: record.id,
      detail: { fy_year: input.fyYear, lead_id: input.leadId, lead_name: lead.leadName },
    });

    return { ok: true };
  } catch (e) {
    console.error('[revenue-budget] addUnsecuredLead error:', e);
    return { ok: false, error: 'Failed to add lead.' };
  }
}

export async function removeUnsecuredRevenueBudget(input: {
  leadId: string;
  fyYear: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireFinanceAccess();
  try {
    const record = await prisma.unsecuredRevenueBudget.findUnique({
      where: { leadId_fyYear: { leadId: input.leadId, fyYear: input.fyYear } },
      select: { id: true, leadName: true },
    });
    if (!record) return { ok: false, error: 'Record not found.' };

    await prisma.unsecuredRevenueBudget.update({
      where: { leadId_fyYear: { leadId: input.leadId, fyYear: input.fyYear } },
      data: { deletedAt: new Date() },
    });

    await createAuditLog({
      userId: user.id,
      action: 'UNSECURED_BUDGET_LEAD_REMOVED',
      entity: 'UnsecuredRevenueBudget',
      entityId: record.id,
      detail: { fy_year: input.fyYear, lead_id: input.leadId, lead_name: record.leadName },
    });

    return { ok: true };
  } catch (e) {
    console.error('[revenue-budget] removeUnsecuredRevenueBudget error:', e);
    return { ok: false, error: 'Failed to remove lead.' };
  }
}

export async function getQualifyingLeads(fyYear: string): Promise<{
  ok: boolean;
  leads?: QualifyingLead[];
  error?: string;
}> {
  const user = await requireFinanceAccess();
  try {
    // Get IDs already in the unsecured budget (not deleted)
    const existing = await prisma.unsecuredRevenueBudget.findMany({
      where: { organisationId: user.organisationId, fyYear, deletedAt: null },
      select: { leadId: true },
    });
    const existingIds = new Set(existing.map((r) => r.leadId));

    const leads = await prisma.lead.findMany({
      where: {
        organisationId: user.organisationId,
        deletedAt: null,
        stage: { in: QUALIFYING_STAGES },
      },
      orderBy: [{ stage: 'asc' }, { leadName: 'asc' }],
      select: { id: true, leadName: true, contractValue: true, stage: true },
    });

    const filtered: QualifyingLead[] = leads
      .filter((l) => !existingIds.has(l.id))
      .map((l) => ({
        id: l.id,
        leadName: l.leadName,
        contractValue: l.contractValue?.toString() ?? null,
        stage: l.stage as string,
      }));

    return { ok: true, leads: filtered };
  } catch (e) {
    console.error('[revenue-budget] getQualifyingLeads error:', e);
    return { ok: false, error: 'Failed to load qualifying leads.' };
  }
}

export async function getBudgetTotals(fyYear: string): Promise<{
  ok: boolean;
  totals?: BudgetTotals;
  error?: string;
}> {
  const user = await requireFinanceAccess();
  try {
    const [projectBudgets, unsecuredBudgets] = await Promise.all([
      prisma.projectRevenueBudget.findMany({
        where: { organisationId: user.organisationId, fyYear },
      }),
      prisma.unsecuredRevenueBudget.findMany({
        where: { organisationId: user.organisationId, fyYear, deletedAt: null },
      }),
    ]);

    const allRecords = [
      ...JSON.parse(JSON.stringify(projectBudgets)),
      ...JSON.parse(JSON.stringify(unsecuredBudgets)),
    ] as Record<string, unknown>[];

    const totals: Record<string, number> = {};
    for (const key of ALL_MONTH_KEYS) {
      totals[key] = 0;
    }

    for (const record of allRecords) {
      for (const key of ALL_MONTH_KEYS) {
        const val = record[key];
        if (val != null) totals[key] += Number(val);
      }
    }

    const result: Record<string, string> = {};
    for (const key of ALL_MONTH_KEYS) {
      result[key] = totals[key].toFixed(2);
    }

    return { ok: true, totals: result as BudgetTotals };
  } catch (e) {
    console.error('[revenue-budget] getBudgetTotals error:', e);
    return { ok: false, error: 'Failed to compute budget totals.' };
  }
}
