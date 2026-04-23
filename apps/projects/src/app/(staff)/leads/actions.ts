'use server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

async function generateLeadNumber(organisationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `EST-${year}-`;
  const latest = await prisma.estimate.findFirst({
    where: { organisationId, leadNumber: { startsWith: prefix } },
    orderBy: { leadNumber: 'desc' },
    select: { leadNumber: true },
  });
  let seq = 1;
  if (latest) {
    const parts = latest.leadNumber.split('-');
    const last = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(last)) seq = last + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

export async function getLeads() {
  const user = await requireAppUser();
  return prisma.estimate.findMany({
    where: { organisationId: user.organisationId },
    include: {
      client: { select: { name: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      _count: { select: { lines: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createLead(fd: FormData) {
  const user = await requireAppUser();
  const leadNumber = await generateLeadNumber(user.organisationId);
  const clientId = (fd.get('clientId') as string) || null;

  const estimate = await prisma.estimate.create({
    data: {
      organisationId: user.organisationId,
      leadNumber,
      title: fd.get('title') as string,
      clientId: clientId || undefined,
      notes: (fd.get('notes') as string) || null,
      createdById: user.id,
    },
  });
  revalidatePath('/leads');
  return estimate.id;
}

export async function updateLeadStatus(id: string, status: string) {
  const user = await requireAppUser();
  await prisma.estimate.update({
    where: { id, organisationId: user.organisationId },
    data: { status: status as never },
  });
  revalidatePath('/leads');
  revalidatePath(`/leads/${id}`);
}

export async function deleteLead(id: string) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR' && user.role !== 'ADMINISTRATOR') throw new Error('Admin only');
  await prisma.estimate.delete({ where: { id, organisationId: user.organisationId } });
  revalidatePath('/leads');
}
