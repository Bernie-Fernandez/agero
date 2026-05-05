import { prisma } from '@/lib/prisma';
import { requireDirector } from '@/lib/auth';
import XeroSettingsClient from './XeroSettingsClient';

export default async function XeroSettingsPage() {
  const user = await requireDirector();

  const conn = await prisma.xeroConnection.findUnique({
    where: { organisationId: user.organisationId },
    include: { connectedBy: { select: { firstName: true, lastName: true } } },
  });

  return <XeroSettingsClient connection={conn as never} />;
}
