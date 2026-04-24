import { NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';

const XERO_AUTH_URL = 'https://login.xero.com/identity/connect/authorize';
const SCOPES = 'openid profile email accounting.reports.read accounting.settings.read offline_access';

export async function GET() {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Build the consent URL manually so scopes are %20-encoded (not + from URLSearchParams)
  const params = [
    'response_type=code',
    `client_id=${encodeURIComponent(process.env.XERO_CLIENT_ID!)}`,
    `redirect_uri=${encodeURIComponent(process.env.XERO_REDIRECT_URI!)}`,
    `scope=${encodeURIComponent(SCOPES)}`,
  ].join('&');

  return NextResponse.redirect(`${XERO_AUTH_URL}?${params}`);
}
