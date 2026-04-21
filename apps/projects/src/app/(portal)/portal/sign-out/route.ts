import { clearPortalSessionCookie } from '@/lib/portal/auth';
import { redirect } from 'next/navigation';

export async function POST() {
  await clearPortalSessionCookie();
  redirect('/portal/login');
}
