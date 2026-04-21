import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import ProjectFoundationsClient from './ProjectFoundationsClient';

export default async function ProjectsPage() {
  const user = await requireAppUser();

  const [projects, subcontractorCompanies] = await Promise.all([
    prisma.project.findMany({
      where: { organisationId: user.organisationId },
      include: {
        client: { select: { id: true, name: true } },
        projectManager: { select: { firstName: true, lastName: true } },
        siteManager: { select: { firstName: true, lastName: true } },
        projectEstimator: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.company.findMany({
      where: { organisationId: user.organisationId, types: { has: 'SUBCONTRACTOR' }, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <ProjectFoundationsClient
      projects={projects as never}
      subcontractorCompanies={subcontractorCompanies}
    />
  );
}
