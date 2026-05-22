import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encryptToken } from '@/lib/crm/crypto';
import { Client } from '@hubspot/api-client';

export async function POST(req: NextRequest) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { accessToken } = await req.json();
  if (!accessToken) return NextResponse.json({ error: 'accessToken required' }, { status: 400 });

  // Validate token by calling HubSpot account info
  let portalId: string | null = null;
  try {
    const client = new Client({ accessToken });
    const info = await client.oauth.accessTokensApi.get(accessToken);
    portalId = String(info.hubId ?? '');
  } catch {
    return NextResponse.json({ error: 'Invalid HubSpot token — could not connect to HubSpot API' }, { status: 400 });
  }

  const encrypted = encryptToken(accessToken);

  await prisma.hubSpotSyncSettings.upsert({
    where: { organisationId: user.organisationId },
    update: {
      accessToken: encrypted,
      portalId,
      status: 'CONNECTED',
      connectedAt: new Date(),
      connectedById: user.id,
    },
    create: {
      organisationId: user.organisationId,
      accessToken: encrypted,
      portalId,
      status: 'CONNECTED',
      connectedAt: new Date(),
      connectedById: user.id,
    },
  });

  return NextResponse.json({ ok: true, portalId });
}
