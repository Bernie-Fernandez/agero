import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runIncrementalSync } from '@/lib/crm/hubspot-sync';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.VERCEL_CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Run incremental sync for all connected organisations
  const connectedOrgs = await prisma.hubSpotSyncSettings.findMany({
    where: { status: 'CONNECTED', accessToken: { not: null } },
    select: { organisationId: true },
  });

  const results: Record<string, unknown> = {};
  for (const org of connectedOrgs) {
    try {
      const result = await runIncrementalSync(org.organisationId);
      results[org.organisationId] = result;
    } catch (err) {
      results[org.organisationId] = { error: String(err) };
    }
  }

  return NextResponse.json({ ok: true, orgs: connectedOrgs.length, results });
}
