import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import PlannedWorkClient from './PlannedWorkClient';

function currentFY() {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

export default async function PlannedWorkPage() {
  const user = await requireAppUser();
  const fy = currentFY();

  const opportunities = await prisma.unsecuredOpportunity.findMany({
    where: { organisationId: user.organisationId, financialYear: fy, deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  return (
    <PlannedWorkClient
      initialOpportunities={JSON.parse(JSON.stringify(opportunities))}
      defaultFY={fy}
    />
  );
}
