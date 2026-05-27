'use server';

import { requireDirector } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';

export type ProjectMasterRow = {
  id: string;
  jobNumber: string;
  projectName: string;
  status: string;
  reportMonth: string;
  notes: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectsListResult = {
  ok: boolean;
  projects: ProjectMasterRow[];
  total: number;
};

export type ProjectMutateResult = {
  ok: boolean;
  project?: ProjectMasterRow;
  error?: string;
};

const PAGE_SIZE = 50;

const SELECT = {
  id: true, jobNumber: true, projectName: true, status: true,
  reportMonth: true, notes: true, deletedAt: true, createdAt: true, updatedAt: true,
} as const;

export async function listFinanceProjectsMaster(opts: {
  search?: string;
  status?: string;
  tab?: 'all' | 'active' | 'archived';
  page?: number;
} = {}): Promise<ProjectsListResult> {
  const user = await requireDirector();
  const { search, status, tab = 'active', page = 1 } = opts;

  const deletedFilter =
    tab === 'archived' ? { not: null } :
    tab === 'active'   ? null :
    undefined;

  const where = {
    organisationId: user.organisationId,
    ...(deletedFilter !== undefined ? { deletedAt: deletedFilter } : {}),
    ...(status ? { status: status as never } : {}),
    ...(search ? {
      OR: [
        { jobNumber: { contains: search, mode: 'insensitive' as const } },
        { projectName: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
  };

  const [projects, total] = await Promise.all([
    prisma.financeProject.findMany({
      where,
      orderBy: [{ jobNumber: 'asc' }, { reportMonth: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: SELECT,
    }),
    prisma.financeProject.count({ where }),
  ]);

  return { ok: true, projects: JSON.parse(JSON.stringify(projects)), total };
}

export async function createFinanceProjectMaster(data: {
  jobNumber: string;
  projectName: string;
  status?: string;
  notes?: string;
}): Promise<ProjectMutateResult> {
  const user = await requireDirector();

  const jobNo = data.jobNumber.trim();
  if (!jobNo) return { ok: false, error: 'Job No is required.' };
  if (!data.projectName.trim()) return { ok: false, error: 'Project Name is required.' };

  const existing = await prisma.financeProject.findFirst({
    where: {
      organisationId: user.organisationId,
      jobNumber: { equals: jobNo, mode: 'insensitive' },
      deletedAt: null,
    },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, error: `Job No "${jobNo}" already exists in the Finance Project table.` };
  }

  const now = new Date();
  const reportMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const project = await prisma.financeProject.create({
    data: {
      organisationId: user.organisationId,
      jobNumber: jobNo,
      projectName: data.projectName.trim(),
      status: (data.status ?? 'AWARDED') as never,
      reportMonth,
      notes: data.notes?.trim() || null,
    },
    select: SELECT,
  });

  await createAuditLog({
    userId: user.id,
    action: 'FINANCE_PROJECT_CREATED',
    entity: 'FinanceProject',
    entityId: project.id,
    detail: { job_number: project.jobNumber, project_name: project.projectName },
  });

  return { ok: true, project: JSON.parse(JSON.stringify(project)) };
}

export async function updateFinanceProjectMaster(
  id: string,
  data: { jobNumber?: string; projectName?: string; status?: string; notes?: string },
): Promise<ProjectMutateResult> {
  const user = await requireDirector();

  const current = await prisma.financeProject.findFirst({
    where: { id, organisationId: user.organisationId },
    select: SELECT,
  });
  if (!current) return { ok: false, error: 'Project not found.' };

  if (data.jobNumber && data.jobNumber.trim().toLowerCase() !== current.jobNumber.trim().toLowerCase()) {
    const dup = await prisma.financeProject.findFirst({
      where: {
        organisationId: user.organisationId,
        jobNumber: { equals: data.jobNumber.trim(), mode: 'insensitive' },
        deletedAt: null,
        NOT: { id },
      },
      select: { id: true },
    });
    if (dup) return { ok: false, error: `Job No "${data.jobNumber}" already exists.` };
  }

  const updated = await prisma.financeProject.update({
    where: { id },
    data: {
      ...(data.jobNumber    ? { jobNumber: data.jobNumber.trim() }       : {}),
      ...(data.projectName  ? { projectName: data.projectName.trim() }   : {}),
      ...(data.status       ? { status: data.status as never }           : {}),
      ...(data.notes !== undefined ? { notes: data.notes.trim() || null } : {}),
    },
    select: SELECT,
  });

  await createAuditLog({
    userId: user.id,
    action: 'FINANCE_PROJECT_UPDATED',
    entity: 'FinanceProject',
    entityId: id,
    detail: { before: JSON.parse(JSON.stringify(current)), after: JSON.parse(JSON.stringify(updated)) },
  });

  return { ok: true, project: JSON.parse(JSON.stringify(updated)) };
}

export async function softDeleteFinanceProjectMaster(id: string): Promise<ProjectMutateResult> {
  const user = await requireDirector();

  const current = await prisma.financeProject.findFirst({
    where: { id, organisationId: user.organisationId, deletedAt: null },
    select: { id: true, jobNumber: true },
  });
  if (!current) return { ok: false, error: 'Project not found.' };

  await prisma.financeProject.update({ where: { id }, data: { deletedAt: new Date() } });

  await createAuditLog({
    userId: user.id,
    action: 'FINANCE_PROJECT_SOFT_DELETED',
    entity: 'FinanceProject',
    entityId: id,
    detail: { job_number: current.jobNumber },
  });

  return { ok: true };
}

export async function restoreFinanceProjectMaster(id: string): Promise<ProjectMutateResult> {
  const user = await requireDirector();

  const current = await prisma.financeProject.findFirst({
    where: { id, organisationId: user.organisationId, deletedAt: { not: null } },
    select: { id: true, jobNumber: true },
  });
  if (!current) return { ok: false, error: 'Project not found or not archived.' };

  const dup = await prisma.financeProject.findFirst({
    where: {
      organisationId: user.organisationId,
      jobNumber: { equals: current.jobNumber, mode: 'insensitive' },
      deletedAt: null,
      NOT: { id },
    },
    select: { id: true },
  });
  if (dup) return { ok: false, error: `An active project with Job No "${current.jobNumber}" already exists.` };

  const restored = await prisma.financeProject.update({
    where: { id },
    data: { deletedAt: null },
    select: SELECT,
  });

  await createAuditLog({
    userId: user.id,
    action: 'FINANCE_PROJECT_RESTORED',
    entity: 'FinanceProject',
    entityId: id,
    detail: { job_number: current.jobNumber },
  });

  return { ok: true, project: JSON.parse(JSON.stringify(restored)) };
}
