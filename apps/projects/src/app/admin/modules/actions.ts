'use server';

import { requireDirector } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { invalidateModuleCache } from '@agero/db';
import { revalidatePath } from 'next/cache';

export async function toggleModuleFlag(module: string, enabled: boolean) {
  const user = await requireDirector();

  const now = new Date();
  await prisma.moduleFlag.update({
    where: { module: module as never },
    data: {
      enabled,
      enabledAt: enabled ? now : null,
      enabledById: enabled ? user.id : null,
      updatedAt: now,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: enabled ? 'MODULE_ENABLED' : 'MODULE_DISABLED',
      entity: 'ModuleFlag',
      detail: { module, from: !enabled, to: enabled },
    },
  });

  // Invalidate the in-memory cache for this module so the change takes effect immediately
  invalidateModuleCache(module);

  revalidatePath('/admin/modules');
}
