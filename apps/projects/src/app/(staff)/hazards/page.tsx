import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import HazardsClient from './HazardsClient';

export default async function HazardsPage() {
  const user = await requireAppUser();

  const [hazards, projects] = await Promise.all([
    prisma.hazard.findMany({
      where: { organisationId: user.organisationId },
      include: {
        project: { select: { id: true, name: true } },
        raisedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.project.findMany({
      where: { organisationId: user.organisationId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return <HazardsClient initialData={hazards as never} projects={projects} />;
}
