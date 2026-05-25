import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';

export default async function DesignLayout({ children }: { children: ReactNode }) {
  await requireAppUser();
  const flag = await prisma.moduleFlag.findUnique({ where: { module: 'design_studio' } });
  if (!flag?.enabled) redirect('/unauthorized?reason=module_disabled&module=design_studio');
  return <>{children}</>;
}
