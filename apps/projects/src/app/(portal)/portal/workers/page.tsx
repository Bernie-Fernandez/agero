import { requirePortalSession } from '@/lib/portal/auth';
import { prisma as safetyPrisma } from '@/lib/safety/prisma';
import PortalShell from '@/components/PortalShell';
import WorkersClient from './WorkersClient';

export default async function PortalWorkersPage() {
  const session = await requirePortalSession();
  const { companyId, company } = session.portalUser;

  let workers: { id: string; firstName: string; lastName: string; mobile: string | null; email: string | null; trade: string | null; project: { name: string } }[] = [];
  try {
    workers = await safetyPrisma.worker.findMany({
      where: { employingOrganisation: { name: company.name } },
      include: { project: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  } catch {
    // Safety data not linked yet
  }

  return (
    <PortalShell companyName={company.name} userName={`${session.portalUser.firstName} ${session.portalUser.lastName}`}>
      <WorkersClient workers={workers} companyId={companyId} />
    </PortalShell>
  );
}
