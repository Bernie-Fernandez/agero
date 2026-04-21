import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import InspectionsClient from './InspectionsClient';

export default async function InspectionsPage() {
  const user = await requireAppUser();

  const [inspections, projects] = await Promise.all([
    prisma.safetyInspection.findMany({
      where: { organisationId: user.organisationId },
      include: {
        project: { select: { id: true, name: true } },
        conductedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { inspectionDate: 'desc' },
    }),
    prisma.project.findMany({
      where: { organisationId: user.organisationId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return <InspectionsClient initialData={inspections as never} projects={projects} />;
}
