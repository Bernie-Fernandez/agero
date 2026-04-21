import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import IncidentsClient from './IncidentsClient';

export default async function IncidentsPage() {
  const user = await requireAppUser();

  const [incidents, projects] = await Promise.all([
    prisma.incident.findMany({
      where: { organisationId: user.organisationId },
      include: {
        project: { select: { id: true, name: true } },
        reportedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { incidentDate: 'desc' },
    }),
    prisma.project.findMany({
      where: { organisationId: user.organisationId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return <IncidentsClient initialData={incidents as never} projects={projects} />;
}
