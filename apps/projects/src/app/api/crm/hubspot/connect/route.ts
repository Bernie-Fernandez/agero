import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encryptToken } from '@/lib/crm/crypto';

export async function POST(req: NextRequest) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { accessToken: rawToken } = await req.json();
  if (!rawToken) return NextResponse.json({ error: 'accessToken required' }, { status: 400 });

  // Trim whitespace — common paste issue with pat- tokens
  const accessToken = String(rawToken).trim();

  // Validate with a real CRM call. The OAuth token-info endpoint rejects Private App (pat-) tokens,
  // including ap1-region tokens. /crm/v3/objects/deals confirms both token validity and deals scope.
  let portalId: string | null = null;
  try {
    const dealsUrl = 'https://api.hubapi.com/crm/v3/objects/deals?limit=1';
    const dealsRes = await fetch(dealsUrl, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });
    console.error('[HubSpot connect] deals probe:', dealsUrl, 'status:', dealsRes.status);
    if (!dealsRes.ok) {
      const body = await dealsRes.text();
      console.error('[HubSpot connect] deals probe body:', body);
      return NextResponse.json(
        { error: `Invalid HubSpot token — HubSpot returned ${dealsRes.status}: ${body.slice(0, 200)}` },
        { status: 400 },
      );
    }

    // Fetch portal/account ID
    const accountUrl = 'https://api.hubapi.com/account-info/v3/details';
    const accountRes = await fetch(accountUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    console.error('[HubSpot connect] account-info status:', accountRes.status);
    if (accountRes.ok) {
      const accountData = await accountRes.json() as { portalId?: number };
      portalId = accountData.portalId ? String(accountData.portalId) : null;
    }
  } catch (err) {
    console.error('[HubSpot connect] fetch error:', err);
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
