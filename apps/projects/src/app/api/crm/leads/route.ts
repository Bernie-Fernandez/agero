import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { pushLeadToHubSpot } from '@/lib/crm/hubspot-sync';

export async function GET(req: NextRequest) {
  const user = await requireAppUser();
  const { searchParams } = req.nextUrl;
  const stage = searchParams.get('stage');
  const search = searchParams.get('search');
  const ownerId = searchParams.get('owner');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = 50;

  const where: Record<string, unknown> = {
    organisationId: user.organisationId,
    deletedAt: null,
  };
  if (stage && stage !== 'ALL') {
    if (stage === 'ACTIVE') {
      where.stage = { in: ['RESEARCH', 'VALIDATED', 'DEVELOPING', 'QUALIFIED', 'SUBMISSION_IN_PROGRESS', 'SUBMISSION_AWAITING', 'INTENT_TO_NEGOTIATE'] };
    } else if (stage === 'CLOSED') {
      where.stage = { in: ['CLOSED_WON', 'CLOSED_LOST', 'DEAD', 'WITHDRAWN'] };
    } else {
      where.stage = stage;
    }
  }
  if (search) {
    where.OR = [
      { leadName: { contains: search, mode: 'insensitive' } },
      { projectLocation: { contains: search, mode: 'insensitive' } },
      { currentAddress: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (ownerId) where.ownerUserId = ownerId;

  const [total, leads] = await Promise.all([
    prisma.lead.count({ where: where as never }),
    prisma.lead.findMany({
      where: where as never,
      include: { ownerUser: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ syncStatus: 'desc' }, { updatedAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({ leads: JSON.parse(JSON.stringify(leads)), total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const user = await requireAppUser();
  const body = await req.json();

  // Create in ERP first, then push to HubSpot if connected
  const lead = await prisma.lead.create({
    data: {
      organisationId: user.organisationId,
      hubspotDealId: body.hubspotDealId ?? `erponly-${Date.now()}`,
      leadName: body.leadName ?? 'New Lead',
      stage: body.stage ?? 'RESEARCH',
      contractValue: body.contractValue != null ? String(body.contractValue) : null,
      entryGpPct: body.entryGpPct != null ? String(body.entryGpPct) : null,
      confidenceRating: body.confidenceRating ?? null,
      probabilityPct: body.probabilityPct != null ? String(body.probabilityPct) : null,
      goNoGoDate: body.goNoGoDate ? new Date(body.goNoGoDate) : null,
      decisionDate: body.decisionDate ? new Date(body.decisionDate) : null,
      contractDate: body.contractDate ? new Date(body.contractDate) : null,
      startDate: body.startDate ? new Date(body.startDate) : null,
      completionDate: body.completionDate ? new Date(body.completionDate) : null,
      leaseExpiryDate: body.leaseExpiryDate ? new Date(body.leaseExpiryDate) : null,
      durationMonths: body.durationMonths ?? null,
      projectLocation: body.projectLocation ?? null,
      serviceType: body.serviceType ?? null,
      dealClassification: body.dealClassification ?? null,
      clientType: body.clientType ?? null,
      floorAreaM2: body.floorAreaM2 != null ? String(body.floorAreaM2) : null,
      currentAddress: body.currentAddress ?? null,
      futureAddress: body.futureAddress ?? null,
      ownerUserId: body.ownerUserId ?? null,
      syncStatus: 'PENDING',
      notes: body.notes ?? null,
    },
  });

  // Try to push to HubSpot, but don't fail if not connected
  try {
    await pushLeadToHubSpot(lead.id, Object.keys(body));
  } catch {}

  return NextResponse.json(JSON.parse(JSON.stringify(lead)), { status: 201 });
}
