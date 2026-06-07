'use server';

import { requireDirector, requireFinanceAccess } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export type FYSettingsRow = {
  id: string;
  currentFY: string;
  draftOpenMonth: number;
  draftOpenDay: number;
  lockOpenMonth: number;
  lockOpenDay: number;
};

export async function getAdminFYSettings(): Promise<{ ok: boolean; settings?: FYSettingsRow; error?: string }> {
  const user = await requireFinanceAccess();
  try {
    const s = await prisma.fYSettings.findUnique({ where: { organisationId: user.organisationId } });
    if (!s) return { ok: true, settings: { id: '', currentFY: 'FY27', draftOpenMonth: 4, draftOpenDay: 1, lockOpenMonth: 7, lockOpenDay: 1 } };
    return { ok: true, settings: { id: s.id, currentFY: s.currentFY, draftOpenMonth: s.draftOpenMonth, draftOpenDay: s.draftOpenDay, lockOpenMonth: s.lockOpenMonth, lockOpenDay: s.lockOpenDay } };
  } catch (e) {
    console.error('[fy-settings] getAdminFYSettings error:', e);
    return { ok: false, error: 'Failed to load settings.' };
  }
}

export async function saveAdminFYSettings(input: {
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
    console.error('[fy-settings] saveAdminFYSettings error:', e);
    return { ok: false, error: 'Failed to save settings.' };
  }
}
