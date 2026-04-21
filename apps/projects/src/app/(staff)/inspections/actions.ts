'use server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function createInspection(fd: FormData) {
  const user = await requireAppUser();
  await prisma.safetyInspection.create({
    data: {
      organisationId: user.organisationId,
      title: fd.get('title') as string,
      inspectionDate: new Date(fd.get('inspectionDate') as string),
      inspector: (fd.get('inspector') as string) || null,
      outcome: (fd.get('outcome') as string) || null,
      notes: (fd.get('notes') as string) || null,
      status: 'OPEN',
      conductedById: user.id,
      projectId: (fd.get('projectId') as string) || null,
    },
  });
  revalidatePath('/inspections');
}
