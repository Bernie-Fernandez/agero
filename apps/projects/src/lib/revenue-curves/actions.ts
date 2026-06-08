'use server';

import { requireDirector, requireFinanceAccess } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ─── Types ─────────────────────────────────────────────────────────────────

export type RevenueCurveRow = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isArchived: boolean;
  periodCount: number;
  weights: number[];
};

// ─── Seed data ──────────────────────────────────────────────────────────────

const SYSTEM_CURVES: Omit<RevenueCurveRow, 'id' | 'isArchived'>[] = [
  {
    name: 'Even Distribution',
    description: 'Equal amount each month. Use for simple or unknown projects.',
    isSystem: true,
    periodCount: 12,
    weights: [8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.37],
  },
  {
    name: 'Standard S-Curve',
    description: 'Slow start, rapid mid-project ramp, taper at completion. Standard construction profile.',
    isSystem: true,
    periodCount: 12,
    weights: [2, 4, 8, 12, 16, 18, 16, 12, 8, 4, 0, 0],
  },
  {
    name: 'Front-Loaded',
    description: 'Higher revenue in early months. Use for fitout projects with upfront procurement and labour.',
    isSystem: true,
    periodCount: 12,
    weights: [18, 16, 14, 12, 10, 8, 7, 6, 5, 2, 1, 1],
  },
  {
    name: 'Back-Loaded',
    description: 'Low early revenue, peaks near completion. Use for projects with long lead procurement or fitout-heavy finishes.',
    isSystem: true,
    periodCount: 12,
    weights: [1, 1, 2, 5, 6, 7, 8, 10, 12, 14, 16, 18],
  },
  {
    name: 'Aggressive S-Curve',
    description: 'Faster ramp than standard, earlier peak. Use for fast-track or time-critical delivery.',
    isSystem: true,
    periodCount: 12,
    weights: [3, 7, 13, 17, 18, 16, 12, 8, 4, 1, 1, 0],
  },
  {
    name: 'Retention Tail (24)',
    description: 'Normal project spread across 12 months with retention tail flowing into months 13–24. Use for contracted jobs carrying retention into the next FY.',
    isSystem: true,
    periodCount: 24,
    weights: [1, 2, 4, 8, 11, 13, 13, 11, 8, 5, 3, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 0.5, 0.5],
  },
];

async function seedIfEmpty(orgId: string) {
  const count = await prisma.revenueCurve.count({ where: { organisationId: orgId } });
  if (count > 0) return;
  await prisma.revenueCurve.createMany({
    data: SYSTEM_CURVES.map((c) => ({
      organisationId: orgId,
      name: c.name,
      description: c.description,
      isSystem: c.isSystem,
      isArchived: false,
      periodCount: c.periodCount,
      weights: c.weights,
    })),
    skipDuplicates: true,
  });
}

// ─── Actions ────────────────────────────────────────────────────────────────

export async function listActiveCurves(): Promise<RevenueCurveRow[]> {
  const user = await requireFinanceAccess();
  await seedIfEmpty(user.organisationId);
  const rows = await prisma.revenueCurve.findMany({
    where: { organisationId: user.organisationId, isArchived: false },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true, description: true, isSystem: true, isArchived: true, periodCount: true, weights: true },
  });
  return rows.map((r) => ({ ...r, weights: r.weights as number[] }));
}

export async function listAllCurves(): Promise<RevenueCurveRow[]> {
  const user = await requireDirector();
  await seedIfEmpty(user.organisationId);
  const rows = await prisma.revenueCurve.findMany({
    where: { organisationId: user.organisationId },
    orderBy: [{ isSystem: 'desc' }, { isArchived: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, description: true, isSystem: true, isArchived: true, periodCount: true, weights: true },
  });
  return rows.map((r) => ({ ...r, weights: r.weights as number[] }));
}

export async function createCurve(input: {
  name: string;
  description?: string;
  periodCount: number;
  weights: number[];
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const user = await requireDirector();
  const sum = input.weights.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 0.1) return { ok: false, error: `Weights must sum to 100 (got ${sum.toFixed(2)}).` };
  if (input.weights.length !== input.periodCount) return { ok: false, error: 'Weights count must match period count.' };
  try {
    const curve = await prisma.revenueCurve.create({
      data: {
        organisationId: user.organisationId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        isSystem: false,
        isArchived: false,
        periodCount: input.periodCount,
        weights: input.weights,
      },
    });
    return { ok: true, id: curve.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Unique')) return { ok: false, error: 'A curve with this name already exists.' };
    return { ok: false, error: 'Failed to create curve.' };
  }
}

export async function updateCurve(
  id: string,
  input: { name: string; description?: string; periodCount: number; weights: number[] },
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  const existing = await prisma.revenueCurve.findFirst({ where: { id, organisationId: user.organisationId } });
  if (!existing) return { ok: false, error: 'Curve not found.' };
  if (existing.isSystem) return { ok: false, error: 'System curves cannot be edited.' };
  const sum = input.weights.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 0.1) return { ok: false, error: `Weights must sum to 100 (got ${sum.toFixed(2)}).` };
  if (input.weights.length !== input.periodCount) return { ok: false, error: 'Weights count must match period count.' };
  try {
    await prisma.revenueCurve.update({
      where: { id },
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        periodCount: input.periodCount,
        weights: input.weights,
      },
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Unique')) return { ok: false, error: 'A curve with this name already exists.' };
    return { ok: false, error: 'Failed to update curve.' };
  }
}

export async function archiveCurve(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  const existing = await prisma.revenueCurve.findFirst({ where: { id, organisationId: user.organisationId } });
  if (!existing) return { ok: false, error: 'Curve not found.' };
  await prisma.revenueCurve.update({ where: { id }, data: { isArchived: !existing.isArchived } });
  return { ok: true };
}

export async function deleteCurve(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  const existing = await prisma.revenueCurve.findFirst({ where: { id, organisationId: user.organisationId } });
  if (!existing) return { ok: false, error: 'Curve not found.' };
  if (existing.isSystem) return { ok: false, error: 'System curves cannot be deleted.' };
  await prisma.revenueCurve.delete({ where: { id } });
  return { ok: true };
}
