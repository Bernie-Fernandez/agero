import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { pushLeadToHubSpot } from '@/lib/crm/hubspot-sync';
import { runIncrementalSync } from '@/lib/crm/hubspot-sync';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { id } = await params;
  const { resolution } = await req.json(); // 'ERP' | 'HUBSPOT'

  const lead = await prisma.lead.findFirst({
    where: { id, organisationId: user.organisationId, syncStatus: 'CONFLICT' },
  });
  if (!lead) return NextResponse.json({ error: 'Not found or not a conflict' }, { status: 404 });

  if (resolution === 'ERP') {
    // Push ERP version to HubSpot
    const allFields = ['leadName', 'stage', 'contractValue', 'entryGpPct', 'confidenceRating',
      'probabilityPct', 'goNoGoDate', 'decisionDate', 'contractDate', 'startDate', 'completionDate',
      'leaseExpiryDate', 'projectLocation', 'serviceType', 'dealClassification', 'clientType',
      'floorAreaM2', 'currentAddress', 'futureAddress'];
    await pushLeadToHubSpot(id, allFields);
    await prisma.lead.update({ where: { id }, data: { syncStatus: 'SYNCED', lastSyncedAt: new Date() } });
  } else if (resolution === 'HUBSPOT') {
    // Pull HubSpot version into ERP
    await runIncrementalSync(user.organisationId);
    // Re-mark as synced if still conflict
    await prisma.lead.update({ where: { id }, data: { syncStatus: 'SYNCED', lastSyncedAt: new Date() } });
  } else {
    return NextResponse.json({ error: 'resolution must be ERP or HUBSPOT' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
