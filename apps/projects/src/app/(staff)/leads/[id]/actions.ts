'use server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import Decimal from 'decimal.js';

// ── Estimate helpers ──────────────────────────────────────────────────────────

export async function getEstimate(id: string) {
  const user = await requireAppUser();
  return prisma.estimate.findFirstOrThrow({
    where: { id, organisationId: user.organisationId },
    include: {
      client: { select: { id: true, name: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      areas: { orderBy: { order: 'asc' } },
      scenarios: { orderBy: { order: 'asc' } },
      tradeSections: { orderBy: { order: 'asc' } },
    },
  });
}

export async function updateEstimateSettings(id: string, fd: FormData) {
  const user = await requireAppUser();
  const num = (key: string) => fd.get(key) ? Number(fd.get(key)) : undefined;
  const str = (key: string) => (fd.get(key) as string) || null;
  await prisma.estimate.update({
    where: { id, organisationId: user.organisationId },
    data: {
      title: (fd.get('title') as string) || undefined,
      notes: str('notes'),
      addressStreet: str('addressStreet'),
      addressSuburb: str('addressSuburb'),
      addressState: str('addressState'),
      addressPostcode: str('addressPostcode'),
      jobType: str('jobType'),
      floorAreaM2: num('floorAreaM2'),
      estimatorId: (fd.get('estimatorId') as string) || undefined,
      revenueCostCodeId: (fd.get('revenueCostCodeId') as string) || undefined,
      targetGpPct: num('targetGpPct'),
      minGpPct: num('minGpPct'),
      defaultMarkupPct: num('defaultMarkupPct'),
      costRecoveryPct: num('costRecoveryPct'),
      budgetCoverageTarget: num('budgetCoverageTarget'),
      tradePackageHighPct: num('tradePackageHighPct'),
      tradePackageMedPct: num('tradePackageMedPct'),
      tradePackageLowPct: num('tradePackageLowPct'),
      marketEvalHighPct: num('marketEvalHighPct'),
      marketEvalMedPct: num('marketEvalMedPct'),
      marketEvalLowPct: num('marketEvalLowPct'),
      declaredMarginDefaultPct: num('declaredMarginDefaultPct'),
      pipelineStage: fd.get('pipelineStage') ? Number(fd.get('pipelineStage')) : undefined,
      confidencePct: fd.get('confidencePct') !== '' && fd.get('confidencePct') != null ? Number(fd.get('confidencePct')) : undefined,
      currencySymbol: (fd.get('currencySymbol') as string) || '$',
      costPerUnitLabel: str('costPerUnitLabel'),
      taxCodeName: (fd.get('taxCodeName') as string) || 'GST',
    },
  });
  revalidatePath(`/leads/${id}`);
  revalidatePath('/leads');
}

// ── Areas ─────────────────────────────────────────────────────────────────────

export async function createArea(estimateId: string, name: string) {
  const user = await requireAppUser();
  const count = await prisma.estimateArea.count({ where: { estimateId } });
  const area = await prisma.estimateArea.create({
    data: { estimateId, name, order: count },
  });
  revalidatePath(`/leads/${estimateId}/cost-plan`);
  return area;
}

export async function deleteArea(estimateId: string, areaId: string) {
  await prisma.estimateArea.delete({ where: { id: areaId } });
  revalidatePath(`/leads/${estimateId}/cost-plan`);
}

// ── Scenarios ─────────────────────────────────────────────────────────────────

export async function createScenario(estimateId: string, name: string, isBase: boolean) {
  const count = await prisma.estimateScenario.count({ where: { estimateId } });
  const scenario = await prisma.estimateScenario.create({
    data: { estimateId, name, isBase, order: count },
  });
  revalidatePath(`/leads/${estimateId}/cost-plan`);
  return scenario;
}

// ── Lines ─────────────────────────────────────────────────────────────────────

export async function getLines(estimateId: string) {
  const user = await requireAppUser();
  return prisma.estimateLine.findMany({
    where: { estimate: { id: estimateId, organisationId: user.organisationId } },
    include: {
      tradeSection: { select: { id: true, name: true, code: true } },
      area: { select: { id: true, name: true } },
      scenario: { select: { id: true, name: true } },
      quantities: true,
      tags: { include: { tag: true } },
    },
    orderBy: [{ tradeSectionId: 'asc' }, { order: 'asc' }],
  });
}

export async function createLine(estimateId: string, fd: FormData) {
  const user = await requireAppUser();
  const qty = new Decimal(fd.get('quantity') as string || '0');
  const rate = new Decimal(fd.get('rate') as string || '0');
  const total = qty.mul(rate);
  const count = await prisma.estimateLine.count({ where: { estimateId } });

  const dmRaw = fd.get('declaredMarginPct') as string;
  const declaredMarginPct = dmRaw ? new Decimal(dmRaw).toDecimalPlaces(2).toNumber() : null;
  const tradePackageId = (fd.get('tradePackageId') as string) || null;

  await prisma.estimateLine.create({
    data: {
      estimateId,
      tradeSectionId: (fd.get('tradeSectionId') as string) || undefined,
      areaId: (fd.get('areaId') as string) || undefined,
      scenarioId: (fd.get('scenarioId') as string) || undefined,
      description: fd.get('description') as string,
      type: (fd.get('type') as never) || 'MATERIAL',
      quantity: qty.toDecimalPlaces(4).toNumber(),
      unit: (fd.get('unit') as string) || null,
      rate: rate.toDecimalPlaces(4).toNumber(),
      total: total.toDecimalPlaces(2).toNumber(),
      isRisk: fd.get('isRisk') === 'true',
      isOption: fd.get('isOption') === 'true',
      isPcSum: fd.get('isPcSum') === 'true',
      isLockaway: fd.get('isLockaway') === 'true',
      isHidden: fd.get('isHidden') === 'true',
      notes: (fd.get('notes') as string) || null,
      order: count,
      declaredMarginPct: declaredMarginPct ?? undefined,
      tradePackageId: tradePackageId || undefined,
    },
  });
  revalidatePath(`/leads/${estimateId}/cost-plan`);
}

export async function updateLine(lineId: string, estimateId: string, fd: FormData) {
  const qty = new Decimal(fd.get('quantity') as string || '0');
  const rate = new Decimal(fd.get('rate') as string || '0');
  const total = qty.mul(rate);

  const dmRaw = fd.get('declaredMarginPct') as string;
  const declaredMarginPct = dmRaw ? new Decimal(dmRaw).toDecimalPlaces(2).toNumber() : null;
  const tradePackageId = (fd.get('tradePackageId') as string) || null;

  await prisma.estimateLine.update({
    where: { id: lineId },
    data: {
      description: fd.get('description') as string,
      type: (fd.get('type') as never) || undefined,
      quantity: qty.toDecimalPlaces(4).toNumber(),
      unit: (fd.get('unit') as string) || null,
      rate: rate.toDecimalPlaces(4).toNumber(),
      total: total.toDecimalPlaces(2).toNumber(),
      isRisk: fd.get('isRisk') === 'true',
      isOption: fd.get('isOption') === 'true',
      isPcSum: fd.get('isPcSum') === 'true',
      isLockaway: fd.get('isLockaway') === 'true',
      isHidden: fd.get('isHidden') === 'true',
      notes: (fd.get('notes') as string) || null,
      declaredMarginPct: declaredMarginPct,
      tradePackageId: tradePackageId || undefined,
    },
  });
  revalidatePath(`/leads/${estimateId}/cost-plan`);
}

export async function deleteLine(lineId: string, estimateId: string) {
  await prisma.estimateLine.delete({ where: { id: lineId } });
  revalidatePath(`/leads/${estimateId}/cost-plan`);
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

export async function createSnapshot(estimateId: string, label: string) {
  const user = await requireAppUser();
  const lines = await prisma.estimateLine.findMany({ where: { estimateId } });
  const estimate = await prisma.estimate.findUniqueOrThrow({ where: { id: estimateId } });

  const total = lines.reduce((sum, l) => sum.plus(new Decimal(l.total.toString())), new Decimal(0));
  const cost = lines.filter((l) => !l.isHidden && !l.isOption && !l.isLockaway)
    .reduce((sum, l) => sum.plus(new Decimal(l.total.toString())), new Decimal(0));

  await prisma.estimateSnapshot.create({
    data: {
      estimateId,
      label,
      snapshotData: {
        lineCount: lines.length,
        totalCost: cost.toFixed(2),
        totalGross: total.toFixed(2),
        targetGpPct: estimate.targetGpPct.toString(),
        timestamp: new Date().toISOString(),
      },
      createdById: user.id,
    },
  });
  revalidatePath(`/leads/${estimateId}/dashboard`);
}

export async function getSnapshots(estimateId: string) {
  return prisma.estimateSnapshot.findMany({
    where: { estimateId },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

// ── Trade Sections (org templates) ────────────────────────────────────────────

export async function getOrgTradeSections() {
  const user = await requireAppUser();
  return prisma.estimateTradeSection.findMany({
    where: { organisationId: user.organisationId, estimateId: null },
    orderBy: { order: 'asc' },
  });
}

export async function addTradeSectionToEstimate(estimateId: string, templateId: string) {
  const template = await prisma.estimateTradeSection.findUniqueOrThrow({ where: { id: templateId } });
  const count = await prisma.estimateTradeSection.count({ where: { estimateId } });
  const section = await prisma.estimateTradeSection.create({
    data: { estimateId, name: template.name, code: template.code, order: count },
  });
  revalidatePath(`/leads/${estimateId}/cost-plan`);
  return section;
}

// ── Options ───────────────────────────────────────────────────────────────────

export async function getOptions(estimateId: string) {
  return prisma.estimateOption.findMany({
    where: { estimateId },
    include: { lines: { include: { line: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function createOption(estimateId: string, name: string, description?: string) {
  await prisma.estimateOption.create({ data: { estimateId, name, description } });
  revalidatePath(`/leads/${estimateId}/options`);
}

export async function toggleLineOption(lineId: string, optionId: string, estimateId: string, add: boolean) {
  if (add) {
    await prisma.estimateOptionLine.upsert({
      where: { optionId_lineId: { optionId, lineId } },
      create: { optionId, lineId },
      update: {},
    });
  } else {
    await prisma.estimateOptionLine.deleteMany({ where: { optionId, lineId } });
  }
  revalidatePath(`/leads/${estimateId}/options`);
}

// ── Lockaways ─────────────────────────────────────────────────────────────────

export async function getLockaways(estimateId: string) {
  return prisma.estimateLockaway.findMany({
    where: { estimateId },
    include: { lines: { include: { line: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function createLockaway(estimateId: string, name: string, notes?: string) {
  await prisma.estimateLockaway.create({ data: { estimateId, name, notes } });
  revalidatePath(`/leads/${estimateId}/lockaway`);
}

export async function toggleLineLockaway(lineId: string, lockawayId: string, estimateId: string, add: boolean) {
  if (add) {
    await prisma.estimateLockawayLine.upsert({
      where: { lockawayId_lineId: { lockawayId, lineId } },
      create: { lockawayId, lineId },
      update: {},
    });
  } else {
    await prisma.estimateLockawayLine.deleteMany({ where: { lockawayId, lineId } });
  }
  revalidatePath(`/leads/${estimateId}/lockaway`);
}

// ── Insight Tags ──────────────────────────────────────────────────────────────

export async function getInsightTags(estimateId: string) {
  return prisma.estimateInsightTag.findMany({
    where: { estimateId },
    include: { lineAssignments: { include: { line: { select: { description: true, total: true } } } } },
    orderBy: { name: 'asc' },
  });
}

export async function createInsightTag(estimateId: string, name: string, color: string) {
  await prisma.estimateInsightTag.create({ data: { estimateId, name, color } });
  revalidatePath(`/leads/${estimateId}/insights`);
}

export async function assignTagToLine(lineId: string, tagId: string, estimateId: string, assign: boolean) {
  if (assign) {
    await prisma.estimateLineTag.upsert({
      where: { lineId_tagId: { lineId, tagId } },
      create: { lineId, tagId },
      update: {},
    });
  } else {
    await prisma.estimateLineTag.deleteMany({ where: { lineId, tagId } });
  }
  revalidatePath(`/leads/${estimateId}/insights`);
}

// ── Trade Packages & Quotes ───────────────────────────────────────────────────

export async function getTradePackages(estimateId: string) {
  return prisma.tradePackage.findMany({
    where: { estimateId },
    include: {
      tradeSection: { select: { name: true, code: true } },
      quotes: {
        include: { subcontractor: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });
}

export async function createTradePackage(estimateId: string, fd: FormData) {
  await prisma.tradePackage.create({
    data: {
      estimateId,
      tradeSectionId: (fd.get('tradeSectionId') as string) || undefined,
      name: fd.get('name') as string,
      scope: (fd.get('scope') as string) || null,
    },
  });
  revalidatePath(`/leads/${estimateId}/trade-letting`);
}

export async function addTradeQuote(packageId: string, estimateId: string, fd: FormData) {
  await prisma.tradeQuote.create({
    data: {
      packageId,
      subcontractorId: (fd.get('subcontractorId') as string) || undefined,
      amount: fd.get('amount') ? new Decimal(fd.get('amount') as string).toNumber() : null,
      notes: (fd.get('notes') as string) || null,
    },
  });
  revalidatePath(`/leads/${estimateId}/trade-letting`);
}

export async function awardQuote(quoteId: string, packageId: string, estimateId: string) {
  await prisma.$transaction([
    prisma.tradeQuote.updateMany({ where: { packageId }, data: { status: 'DECLINED' } }),
    prisma.tradeQuote.update({ where: { id: quoteId }, data: { status: 'AWARDED' } }),
    prisma.tradePackage.update({ where: { id: packageId }, data: { status: 'AWARDED' } }),
  ]);
  revalidatePath(`/leads/${estimateId}/trade-letting`);
}

// ── Scope Library ─────────────────────────────────────────────────────────────

export async function getScopeLibraryItems(estimateId: string) {
  const user = await requireAppUser();
  const estimate = await prisma.estimate.findUniqueOrThrow({ where: { id: estimateId }, select: { organisationId: true } });
  return prisma.scopeLibraryItem.findMany({
    where: { organisationId: estimate.organisationId },
    include: { tradeSection: { select: { name: true, code: true } } },
    orderBy: [{ tradeSectionId: 'asc' }, { description: 'asc' }],
  });
}

export async function createScopeLibraryItem(fd: FormData) {
  const user = await requireAppUser();
  await prisma.scopeLibraryItem.create({
    data: {
      organisationId: user.organisationId,
      tradeSectionId: (fd.get('tradeSectionId') as string) || undefined,
      description: fd.get('description') as string,
      unit: (fd.get('unit') as string) || null,
      notes: (fd.get('notes') as string) || null,
      isGlobal: fd.get('isGlobal') === 'true',
    },
  });
  revalidatePath('/leads');
}

export async function deleteScopeLibraryItem(id: string) {
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') throw new Error('Admin only');
  await prisma.scopeLibraryItem.delete({ where: { id } });
  revalidatePath('/leads');
}

// ── Convert to Project ────────────────────────────────────────────────────────

export async function convertToProject(estimateId: string, fd: FormData) {
  const user = await requireAppUser();
  const estimate = await prisma.estimate.findFirstOrThrow({
    where: { id: estimateId, organisationId: user.organisationId },
  });

  const project = await prisma.project.create({
    data: {
      organisationId: user.organisationId,
      name: fd.get('projectName') as string || estimate.title,
      clientId: estimate.clientId || undefined,
      status: 'PRECONSTRUCTION',
      contractValue: fd.get('contractValue') ? Number(fd.get('contractValue')) : null,
      createdById: user.id,
    },
  });

  await prisma.estimate.update({
    where: { id: estimateId },
    data: { status: 'CONVERTED', convertedToProjectId: project.id },
  });

  revalidatePath(`/leads/${estimateId}`);
  revalidatePath('/leads');
  return project.id;
}
