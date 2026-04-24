import { NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { getXeroClient } from '@/lib/xero/client';

export async function GET() {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const xero = getXeroClient();
  const consentUrl = await xero.buildConsentUrl();
  return NextResponse.redirect(consentUrl);
}
