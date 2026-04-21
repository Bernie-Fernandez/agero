import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import ProjectsListClient from './ProjectsListClient';

export default async function ProjectsPage() {
  const user = await requireAppUser();

  const [projects, companies] = await Promise.all([
    prisma.project.findMany({
      where: { organisationId: user.organisationId },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.company.findMany({
      where: { organisationId: user.organisationId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return <ProjectsListClient initialProjects={projects as never} companies={companies} />;
}
