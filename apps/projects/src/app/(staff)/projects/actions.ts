'use server';
import { prisma, ProjectStatus } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const VALID_STATUSES = Object.values(ProjectStatus);

function parseStatus(raw: string | null | undefined): ProjectStatus {
  if (raw && VALID_STATUSES.includes(raw as ProjectStatus)) return raw as ProjectStatus;
  return ProjectStatus.ACTIVE;
}

export async function createProject(formData: FormData) {
  const user = await requireAppUser();

  const name = (formData.get('name') as string)?.trim();
  if (!name) redirect('/projects?error=missing-name');

  const projectNumber = (formData.get('projectNumber') as string)?.trim() || null;
  const clientId = (formData.get('clientId') as string)?.trim() || null;
  const siteAddress = (formData.get('siteAddress') as string)?.trim() || null;
  const status = parseStatus((formData.get('status') as string)?.trim());
  const contractValueRaw = (formData.get('contractValue') as string)?.trim();
  const contractValue = contractValueRaw ? parseFloat(contractValueRaw) : null;
  const startDateRaw = (formData.get('startDate') as string)?.trim();
  const endDateRaw = (formData.get('endDate') as string)?.trim();

  await prisma.project.create({
    data: {
      organisationId: user.organisationId,
      createdById: user.id,
      name,
      projectNumber,
      clientId: clientId || null,
      siteAddress,
      status,
      contractValue: contractValue ?? undefined,
      startDate: startDateRaw ? new Date(startDateRaw) : null,
      endDate: endDateRaw ? new Date(endDateRaw) : null,
    },
  });

  revalidatePath('/projects');
  redirect('/projects');
}

export async function updateProject(id: string, formData: FormData) {
  await requireAppUser();

  const name = (formData.get('name') as string)?.trim();
  if (!name) redirect(`/projects/${id}/edit?error=missing-name`);

  const projectNumber = (formData.get('projectNumber') as string)?.trim() || null;
  const clientId = (formData.get('clientId') as string)?.trim() || null;
  const siteAddress = (formData.get('siteAddress') as string)?.trim() || null;
  const status = parseStatus((formData.get('status') as string)?.trim());
  const contractValueRaw = (formData.get('contractValue') as string)?.trim();
  const contractValue = contractValueRaw ? parseFloat(contractValueRaw) : null;
  const startDateRaw = (formData.get('startDate') as string)?.trim();
  const endDateRaw = (formData.get('endDate') as string)?.trim();

  await prisma.project.update({
    where: { id },
    data: {
      name,
      projectNumber,
      clientId: clientId || null,
      siteAddress,
      status,
      contractValue: contractValue ?? undefined,
      startDate: startDateRaw ? new Date(startDateRaw) : null,
      endDate: endDateRaw ? new Date(endDateRaw) : null,
    },
  });

  revalidatePath(`/projects/${id}`);
  revalidatePath('/projects');
  redirect(`/projects/${id}`);
}

export async function getProjectAssignments(projectId: string) {
  await requireAppUser();
  return prisma.projectSubcontractor.findMany({
    where: { projectId },
    include: { company: { select: { id: true, name: true } } },
    orderBy: { assignedAt: 'desc' },
  });
}
