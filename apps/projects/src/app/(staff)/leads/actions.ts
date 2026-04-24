'use server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { DEFAULT_COST_PLAN } from '@agero/db';
import { createAuditLog } from '@/lib/audit';

const STAGE_CONFIDENCE: Record<number, number> = {
  3: 25, 4: 40, 5: 50, 6: 65, 7: 100,
  8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0,
};

async function generateLeadNumber(organisationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `EST-${year}-`;
  const latest = await prisma.estimate.findFirst({
    where: { organisationId, leadNumber: { startsWith: prefix } },
    orderBy: { leadNumber: 'desc' },
    select: { leadNumber: true },
  });
  let seq = 1;
  if (latest) {
    const parts = latest.leadNumber.split('-');
    const last = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(last)) seq = last + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

async function createDefaultCostPlan(estimateId: string, defaultMarkupPct: number) {
  for (const section of DEFAULT_COST_PLAN) {
    const tradeSection = await prisma.estimateTradeSection.create({
      data: {
        estimateId,
        name: section.name,
        code: section.code,
        order: section.order,
      },
    });

    const linePrefix = section.code;
    const lineCreates = section.lines.map((line, idx) => ({
      estimateId,
      tradeSectionId: tradeSection.id,
      description: line.description,
      lineStructure: line.line_structure as never,
      unit: line.line_structure === 'SUB_HEADING' ? null : line.unit,
      rate: line.line_structure === 'STANDARD_LINE' ? line.default_rate : 0,
      quantity: 0,
      total: 0,
      markupPct: line.line_structure === 'STANDARD_LINE' ? defaultMarkupPct : null,
      lineCode: line.line_structure === 'STANDARD_LINE'
        ? `${linePrefix}${String(idx + 1).padStart(3, '0')}`
        : null,
      order: line.sort_order,
    }));

    await prisma.estimateLine.createMany({ data: lineCreates });
  }
}

export async function getLeads() {
  const user = await requireAppUser();
  return prisma.estimate.findMany({
    where: { organisationId: user.organisationId },
    include: {
      client: { select: { name: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      _count: { select: { lines: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createLead(fd: FormData) {
  const user = await requireAppUser();
  const leadNumber = await generateLeadNumber(user.organisationId);
  const clientId = (fd.get('clientId') as string) || null;
  const estimatorId = (fd.get('estimatorId') as string) || user.id;
  const revenueCostCodeId = (fd.get('revenueCostCodeId') as string) || null;
  const floorAreaRaw = fd.get('floorAreaM2') as string;
  const floorAreaM2 = floorAreaRaw ? parseFloat(floorAreaRaw) : null;
  const pipelineStage = parseInt((fd.get('pipelineStage') as string) || '3', 10);
  const confidenceRaw = fd.get('confidencePct') as string;
  const confidencePct = confidenceRaw !== '' ? parseInt(confidenceRaw, 10) : STAGE_CONFIDENCE[pipelineStage] ?? 25;

  const estimate = await prisma.estimate.create({
    data: {
      organisationId: user.organisationId,
      leadNumber,
      title: fd.get('title') as string,
      clientId: clientId || undefined,
      notes: (fd.get('notes') as string) || null,
      createdById: user.id,
      pipelineStage,
      confidencePct,
      addressStreet: (fd.get('addressStreet') as string) || null,
      addressSuburb: (fd.get('addressSuburb') as string) || null,
      addressState: (fd.get('addressState') as string) || null,
      addressPostcode: (fd.get('addressPostcode') as string) || null,
      jobType: (fd.get('jobType') as string) || null,
      estimatorId,
      revenueCostCodeId: revenueCostCodeId || undefined,
      floorAreaM2: floorAreaM2 ?? undefined,
    },
  });

  // Seed default cost plan for every new lead
  await createDefaultCostPlan(estimate.id, 48.15);

  await createAuditLog({ userId: user.id, action: 'CREATE', entity: 'Estimate', entityId: estimate.id });
  revalidatePath('/leads');
  return estimate.id;
}

export async function updateLeadStatus(id: string, status: string) {
  const user = await requireAppUser();
  await prisma.estimate.update({
    where: { id, organisationId: user.organisationId },
    data: { status: status as never },
  });
  revalidatePath('/leads');
  revalidatePath(`/leads/${id}`);
}

export async function deleteLead(id: string) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') throw new Error('Admin only');
  await prisma.estimate.delete({ where: { id, organisationId: user.organisationId } });
  revalidatePath('/leads');
}
