'use server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { syncSafetySubcontractorAssign, syncSafetySubcontractorRemove } from '@/lib/safety/safety-subcontractor-sync';

export async function assignSubcontractor(projectId: string, companyId: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const user = await requireAppUser();
  try {
    const a = await prisma.projectSubcontractor.create({
      data: { projectId, companyId, assignedById: user.id },
    });

    // Sync to Safety (non-fatal) — find or create the Safety Organisation and
    // upsert project_subcontractors so Layer 2 of the readiness dashboard reflects this.
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, abn: true, addressStreet: true, addressSuburb: true, addressState: true, types: true },
    });
    if (company) {
      const addressParts = [company.addressStreet, company.addressSuburb, company.addressState].filter(Boolean);
      void syncSafetySubcontractorAssign({
        erpProjectId: projectId,
        company: {
          name: company.name,
          abn: company.abn ?? null,
          address: addressParts.length > 0 ? addressParts.join(', ') : null,
          tradeCategories: company.types,
        },
      });
    }

    revalidatePath(`/projects/${projectId}`);
    return { ok: true, id: a.id };
  } catch {
    return { ok: false, error: 'Already assigned or failed' };
  }
}

export async function removeSubcontractor(assignmentId: string): Promise<void> {
  const assignment = await prisma.projectSubcontractor.findUnique({
    where: { id: assignmentId },
    include: { company: { select: { name: true, abn: true } } },
  });
  if (!assignment) return;
  await prisma.projectSubcontractor.delete({ where: { id: assignmentId } });

  // Sync removal to Safety (non-fatal)
  if (assignment.company) {
    void syncSafetySubcontractorRemove({
      erpProjectId: assignment.projectId,
      company: { name: assignment.company.name, abn: assignment.company.abn ?? null },
    });
  }

  revalidatePath(`/projects/${assignment.projectId}`);
}
