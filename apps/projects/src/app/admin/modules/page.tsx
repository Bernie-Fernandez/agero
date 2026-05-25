import { requireDirector } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ModulesClient from './ModulesClient';

export default async function ModulesPage() {
  await requireDirector();

  const flags = await prisma.moduleFlag.findMany({
    orderBy: { module: 'asc' },
    include: {
      enabledBy: { select: { firstName: true, lastName: true } },
    },
  });

  return <ModulesClient flags={flags as never} />;
}
