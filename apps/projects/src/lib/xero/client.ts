import { XeroClient } from 'xero-node';
import { prisma } from '@/lib/prisma';
import { decryptToken, encryptToken } from './crypto';

export function getXeroClient() {
  return new XeroClient({
    clientId: process.env.XERO_CLIENT_ID!,
    clientSecret: process.env.XERO_CLIENT_SECRET!,
    redirectUris: [process.env.XERO_REDIRECT_URI!],
    scopes: [
      'openid', 'profile', 'email',
      'accounting.reports.profitandloss.read',
      'accounting.reports.balancesheet.read',
      'accounting.reports.banksummary.read',
      'offline_access',
    ],
  });
}

export async function getRefreshedXeroClient(organisationId: string): Promise<XeroClient | null> {
  const conn = await prisma.xeroConnection.findUnique({ where: { organisationId } });
  if (!conn || conn.status === 'DISCONNECTED') return null;

  const xero = getXeroClient();
  const nowMs = Date.now();
  const expiryMs = conn.tokenExpiry.getTime();

  let accessToken = decryptToken(conn.accessToken);
  const refreshToken = decryptToken(conn.refreshToken);

  // Refresh if expiry is within 5 minutes
  if (expiryMs - nowMs < 5 * 60 * 1000) {
    xero.setTokenSet({ access_token: accessToken, refresh_token: refreshToken });
    const newSet = await xero.refreshWithRefreshToken(
      process.env.XERO_CLIENT_ID!,
      process.env.XERO_CLIENT_SECRET!,
      refreshToken,
    );
    accessToken = newSet.access_token!;
    const newExpiry = new Date(Date.now() + (newSet.expires_in ?? 1800) * 1000);
    await prisma.xeroConnection.update({
      where: { organisationId },
      data: {
        accessToken: encryptToken(accessToken),
        refreshToken: encryptToken(newSet.refresh_token ?? refreshToken),
        tokenExpiry: newExpiry,
        lastUsedAt: new Date(),
        status: 'CONNECTED',
      },
    });
  }

  xero.setTokenSet({ access_token: accessToken, refresh_token: refreshToken });
  if (conn.xeroTenantId) {
    await xero.updateTenants(false);
    if (xero.tenants.length === 0) {
      // Fallback: manually set tenants if updateTenants returned none
      (xero as unknown as { tenants: unknown[] }).tenants = [{ tenantId: conn.xeroTenantId, tenantName: conn.xeroOrgName ?? '', tenantType: 'ORGANISATION', id: conn.xeroTenantId, authEventId: '' }];
    }
  }
  await prisma.xeroConnection.update({
    where: { organisationId },
    data: { lastUsedAt: new Date() },
  });
  return xero;
}
