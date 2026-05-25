import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';

export default async function ProjectDeliveryLayout({ children }: { children: ReactNode }) {
  await requireAppUser();
  const flag = await prisma.moduleFlag.findUnique({ where: { module: 'project_delivery' } });
  if (!flag?.enabled) redirect('/unauthorized?reason=module_disabled&module=project_delivery');
  return <>{children}</>;
}
