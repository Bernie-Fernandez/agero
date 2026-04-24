import { requireDirector } from '@/lib/auth';
import { ReactNode } from 'react';

export default async function FinanceLayout({ children }: { children: ReactNode }) {
  await requireDirector();
  return <>{children}</>;
}
