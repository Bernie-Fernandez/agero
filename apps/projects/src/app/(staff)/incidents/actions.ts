'use server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function createIncident(fd: FormData) {
  const user = await requireAppUser();
  await prisma.incident.create({
    data: {
      organisationId: user.organisationId,
      title: fd.get('title') as string,
      description: (fd.get('description') as string) || null,
      incidentDate: new Date(fd.get('incidentDate') as string),
      location: (fd.get('location') as string) || null,
      severity: (fd.get('severity') as string) || 'LOW',
      status: 'OPEN',
      reportedById: user.id,
      projectId: (fd.get('projectId') as string) || null,
    },
  });
  revalidatePath('/incidents');
}

export async function updateIncidentStatus(id: string, status: string) {
  await requireAppUser();
  await prisma.incident.update({ where: { id }, data: { status } });
  revalidatePath('/incidents');
}
