import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import PermitsClient from './PermitsClient';

export default async function PermitsPage() {
  const user = await requireAppUser();

  const [permits, projects] = await Promise.all([
    prisma.permit.findMany({
      where: { organisationId: user.organisationId },
      include: {
        project: { select: { id: true, name: true } },
        issuedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { startDate: 'desc' },
    }),
    prisma.project.findMany({
      where: { organisationId: user.organisationId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return <PermitsClient initialData={permits as never} projects={projects} />;
}
