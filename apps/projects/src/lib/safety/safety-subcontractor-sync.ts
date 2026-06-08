'use server';

import { prisma } from './prisma';

/**
 * Called from ERP's assignSubcontractor action.
 *
 * 1. Find or create a Safety Organisation matching by ABN (or name fallback).
 * 2. Upsert a project_subcontractors row so the Safety readiness dashboard
 *    Layer 2 picks it up immediately.
 *
 * Errors are non-fatal — ERP operations must not fail because Safety sync fails.
 */
export async function syncSafetySubcontractorAssign({
  erpProjectId,
  company,
}: {
  erpProjectId: string;
  company: {
    name: string;
    abn: string | null;
    address: string | null;
    tradeCategories: string[];
  };
}): Promise<void> {
  try {
    // 1. Find or create Safety Organisation
    let safetyOrg: { id: string } | null = null;

    if (company.abn) {
      safetyOrg = await prisma.organisation.findFirst({
        where: { abn: company.abn },
        select: { id: true },
      });
    }

    if (!safetyOrg) {
      safetyOrg = await prisma.organisation.findFirst({
        where: { name: company.name },
        select: { id: true },
      });
    }

    if (!safetyOrg) {
      safetyOrg = await prisma.organisation.create({
        data: {
          name: company.name,
          abn: company.abn ?? undefined,
          address: company.address ?? undefined,
          tradeCategories: company.tradeCategories,
          tradeCategory: company.tradeCategories[0] ?? undefined,
        },
        select: { id: true },
      });
    }

    // 2. Upsert project_subcontractors (idempotent)
    await prisma.projectSubcontractor.upsert({
      where: {
        projectId_subcontractorOrgId: {
          projectId: erpProjectId,
          subcontractorOrgId: safetyOrg.id,
        },
      },
      create: { projectId: erpProjectId, subcontractorOrgId: safetyOrg.id },
      update: {},
    });
  } catch (e) {
    console.error('[syncSafetySubcontractorAssign] error:', e);
  }
}

/**
 * Called from ERP's removeSubcontractor action.
 * Removes the project_subcontractors row for this company on this project.
 * Does NOT delete the Organisation — it may be on other projects.
 */
export async function syncSafetySubcontractorRemove({
  erpProjectId,
  company,
}: {
  erpProjectId: string;
  company: { name: string; abn: string | null };
}): Promise<void> {
  try {
    let safetyOrg: { id: string } | null = null;

    if (company.abn) {
      safetyOrg = await prisma.organisation.findFirst({
        where: { abn: company.abn },
        select: { id: true },
      });
    }

    if (!safetyOrg) {
      safetyOrg = await prisma.organisation.findFirst({
        where: { name: company.name },
        select: { id: true },
      });
    }

    if (!safetyOrg) return;

    await prisma.projectSubcontractor.deleteMany({
      where: { projectId: erpProjectId, subcontractorOrgId: safetyOrg.id },
    });
  } catch (e) {
    console.error('[syncSafetySubcontractorRemove] error:', e);
  }
}
