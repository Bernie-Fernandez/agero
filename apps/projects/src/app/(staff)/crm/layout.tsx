import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';

export default async function CrmLayout({ children }: { children: ReactNode }) {
  await requireAppUser();
  const flag = await prisma.moduleFlag.findUnique({ where: { module: 'crm' } });
  if (!flag?.enabled) redirect('/unauthorized?reason=module_disabled&module=crm');
  return <>{children}</>;
}
