'use server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function assignSubcontractor(projectId: string, companyId: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const user = await requireAppUser();
  try {
    const a = await prisma.projectSubcontractor.create({
      data: { projectId, companyId, assignedById: user.id },
    });
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, id: a.id };
  } catch {
    return { ok: false, error: 'Already assigned or failed' };
  }
}

export async function removeSubcontractor(assignmentId: string): Promise<void> {
  const assignment = await prisma.projectSubcontractor.findUnique({ where: { id: assignmentId } });
  if (!assignment) return;
  await prisma.projectSubcontractor.delete({ where: { id: assignmentId } });
  revalidatePath(`/projects/${assignment.projectId}`);
}
