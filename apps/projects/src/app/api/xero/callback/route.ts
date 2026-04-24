import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getXeroClient } from '@/lib/xero/client';
import { encryptToken } from '@/lib/xero/crypto';

export async function GET(req: NextRequest) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') {
    return NextResponse.redirect(new URL('/unauthorized', req.url));
  }

  const xero = getXeroClient();
  const tokenSet = await xero.apiCallback(req.url);
  await xero.updateTenants();

  const tenant = xero.tenants[0];
  const expiry = new Date(Date.now() + (tokenSet.expires_in ?? 1800) * 1000);

  await prisma.xeroConnection.upsert({
    where: { organisationId: user.organisationId },
    update: {
      xeroTenantId: tenant?.tenantId ?? null,
      xeroOrgName: tenant?.tenantName ?? null,
      accessToken: encryptToken(tokenSet.access_token!),
      refreshToken: encryptToken(tokenSet.refresh_token!),
      tokenExpiry: expiry,
      connectedById: user.id,
      connectedAt: new Date(),
      status: 'CONNECTED',
    },
    create: {
      organisationId: user.organisationId,
      xeroTenantId: tenant?.tenantId ?? null,
      xeroOrgName: tenant?.tenantName ?? null,
      accessToken: encryptToken(tokenSet.access_token!),
      refreshToken: encryptToken(tokenSet.refresh_token!),
      tokenExpiry: expiry,
      connectedById: user.id,
      connectedAt: new Date(),
      status: 'CONNECTED',
    },
  });

  return NextResponse.redirect(new URL('/finance/settings/xero?connected=1', req.url));
}
