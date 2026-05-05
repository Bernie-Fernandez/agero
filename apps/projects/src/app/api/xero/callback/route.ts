import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encryptToken } from '@/lib/xero/crypto';

type XeroTokenSet = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
};

type XeroTenant = {
  tenantId: string;
  tenantName: string;
  tenantType: string;
};

export async function GET(req: NextRequest) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') {
    return NextResponse.redirect(new URL('/unauthorized', req.url));
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  if (!code) {
    return NextResponse.redirect(new URL('/finance/settings/xero?error=no_code', req.url));
  }

  const basicAuth = Buffer.from(
    `${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`
  ).toString('base64');

  const tokenRes = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.XERO_REDIRECT_URI!,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error('Xero token exchange failed:', err);
    return NextResponse.redirect(new URL('/finance/settings/xero?error=token_exchange', req.url));
  }

  const tokenSet = (await tokenRes.json()) as XeroTokenSet;

  const tenantsRes = await fetch('https://api.xero.com/connections', {
    headers: { Authorization: `Bearer ${tokenSet.access_token}` },
  });
  const tenants = tenantsRes.ok ? ((await tenantsRes.json()) as XeroTenant[]) : [];
  const tenant = tenants[0];
  const expiry = new Date(Date.now() + (tokenSet.expires_in ?? 1800) * 1000);

  await prisma.xeroConnection.upsert({
    where: { organisationId: user.organisationId },
    update: {
      xeroTenantId: tenant?.tenantId ?? null,
      xeroOrgName: tenant?.tenantName ?? null,
      accessToken: encryptToken(tokenSet.access_token),
      refreshToken: encryptToken(tokenSet.refresh_token),
      tokenExpiry: expiry,
      connectedById: user.id,
      connectedAt: new Date(),
      status: 'CONNECTED',
    },
    create: {
      organisationId: user.organisationId,
      xeroTenantId: tenant?.tenantId ?? null,
      xeroOrgName: tenant?.tenantName ?? null,
      accessToken: encryptToken(tokenSet.access_token),
      refreshToken: encryptToken(tokenSet.refresh_token),
      tokenExpiry: expiry,
      connectedById: user.id,
      connectedAt: new Date(),
      status: 'CONNECTED',
    },
  });

  return NextResponse.redirect(new URL('/finance/settings/xero?connected=1', req.url));
}
