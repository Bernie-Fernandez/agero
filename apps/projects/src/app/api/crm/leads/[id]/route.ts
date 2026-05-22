import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { applyCascade } from '@/lib/crm/cascade';
import { pushLeadToHubSpot } from '@/lib/crm/hubspot-sync';

const DATE_FIELDS = ['goNoGoDate', 'decisionDate', 'contractDate', 'startDate', 'completionDate', 'leaseExpiryDate'] as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAppUser();
  const { id } = await params;
  const lead = await prisma.lead.findFirst({
    where: { id, organisationId: user.organisationId, deletedAt: null },
    include: {
      ownerUser: { select: { id: true, firstName: true, lastName: true } },
      syncLogs: { orderBy: { syncedAt: 'desc' }, take: 5 },
    },
  });
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(JSON.parse(JSON.stringify(lead)));
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAppUser();
  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.lead.findFirst({
    where: { id, organisationId: user.organisationId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const settings = await prisma.hubSpotSyncSettings.findUnique({
    where: { organisationId: user.organisationId },
  });
  const cascadeConfig = { contractToStartOffsetDays: settings?.contractToStartOffsetDays ?? 14 };

  // Build update data — detect which date field changed to apply cascade
  const updateData: Record<string, unknown> = {};
  const changedFields: string[] = [];

  const scalarFields = ['leadName', 'stage', 'contractValue', 'entryGpPct', 'confidenceRating',
    'probabilityPct', 'durationMonths', 'projectLocation', 'serviceType', 'dealClassification',
    'clientType', 'floorAreaM2', 'currentAddress', 'futureAddress', 'ownerUserId', 'notes'] as const;

  for (const field of scalarFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
      changedFields.push(field);
    }
  }

  // Handle decimal fields
  for (const f of ['contractValue', 'entryGpPct', 'probabilityPct', 'floorAreaM2'] as const) {
    if (body[f] !== undefined) {
      updateData[f] = body[f] != null ? String(body[f]) : null;
    }
  }

  // Handle date fields with cascade
  let cascadeSource: typeof DATE_FIELDS[number] | null = null;
  for (const field of DATE_FIELDS) {
    if (body[field] !== undefined) {
      if (cascadeSource === null) cascadeSource = field;
      changedFields.push(field);
    }
  }

  if (cascadeSource !== null) {
    // Build current date snapshot
    const currentDates = {
      goNoGoDate: existing.goNoGoDate,
      decisionDate: existing.decisionDate,
      contractDate: existing.contractDate,
      startDate: existing.startDate,
      completionDate: existing.completionDate,
      leaseExpiryDate: existing.leaseExpiryDate,
      durationMonths: body.durationMonths ?? existing.durationMonths,
    };
    // Apply the changed value
    const newVal = body[cascadeSource] ? new Date(body[cascadeSource]) : null;
    const cascaded = applyCascade(currentDates, cascadeSource, newVal, cascadeConfig);

    for (const field of DATE_FIELDS) {
      updateData[field] = cascaded[field] ?? null;
      if (cascaded[field] !== currentDates[field as keyof typeof currentDates]) {
        if (!changedFields.includes(field)) changedFields.push(field);
      }
    }
    if (body.durationMonths !== undefined) {
      updateData.durationMonths = body.durationMonths;
    }
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: { ...updateData, syncStatus: 'PENDING' },
    include: {
      ownerUser: { select: { id: true, firstName: true, lastName: true } },
      syncLogs: { orderBy: { syncedAt: 'desc' }, take: 5 },
    },
  });

  // Push to HubSpot async — return immediately, don't block
  pushLeadToHubSpot(id, changedFields).catch(() => {});

  return NextResponse.json(JSON.parse(JSON.stringify(updated)));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAppUser();
  const { id } = await params;
  const existing = await prisma.lead.findFirst({
    where: { id, organisationId: user.organisationId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
