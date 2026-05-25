import { requireDirector } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';

export default async function FinanceLayout({ children }: { children: ReactNode }) {
  await requireDirector();
  const flag = await prisma.moduleFlag.findUnique({ where: { module: 'finance' } });
  if (!flag?.enabled) redirect('/unauthorized?reason=module_disabled&module=finance');
  return <>{children}</>;
}
