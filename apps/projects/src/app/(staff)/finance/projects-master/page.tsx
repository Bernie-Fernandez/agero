import { requireDirector } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ProjectsMasterClient from './ProjectsMasterClient';

export default async function ProjectsMasterPage() {
  const user = await requireDirector();

  const [projects, total] = await Promise.all([
    prisma.financeProject.findMany({
      where: { organisationId: user.organisationId, deletedAt: null },
      orderBy: [{ jobNumber: 'asc' }, { reportMonth: 'desc' }],
      take: 50,
      select: {
        id: true, jobNumber: true, projectName: true, status: true,
        reportMonth: true, notes: true, deletedAt: true, createdAt: true, updatedAt: true,
      },
    }),
    prisma.financeProject.count({
      where: { organisationId: user.organisationId, deletedAt: null },
    }),
  ]);

  return (
    <ProjectsMasterClient
      initialProjects={JSON.parse(JSON.stringify(projects))}
      initialTotal={total}
    />
  );
}
