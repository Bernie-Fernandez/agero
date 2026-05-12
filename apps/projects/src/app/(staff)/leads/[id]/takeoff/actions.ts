'use server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function uploadTakeoffCsv(estimateId: string, formData: FormData) {
  const user = await requireAppUser();
  const csvFile = formData.get('csv') as File;
  const text = await csvFile.text();
  const lines = text.split('\n').filter(Boolean);
  if (lines.length < 2) return { error: 'CSV is empty or has no data rows.' };

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z_0-9 ]/g, '').replace(/ +/g, '_'));

  function getCol(row: string[], ...names: string[]): string {
    for (const name of names) {
      const idx = headers.findIndex((h) => h === name || h.includes(name));
      if (idx >= 0) return (row[idx] ?? '').trim().replace(/^["']|["']$/g, '');
    }
    return '';
  }

  const importRecord = await prisma.takeoffImport.create({
    data: {
      estimateId,
      csvFilename: csvFile.name,
      importStatus: 'pending',
      rowCount: lines.length - 1,
      importedById: user.id,
    },
  });

  // Get org from estimate
  const estimate = await prisma.estimate.findFirst({ where: { id: estimateId }, select: { organisationId: true } });
  const orgItems = await prisma.referenceLibraryItem.findMany({
    where: { organisationId: estimate!.organisationId, isActive: true },
    include: {
      rates: { where: { rateType: 'standard' }, take: 1 },
    },
  });
  const refByCode = new Map(orgItems.map((i) => [i.ageroRef, i]));

  const measurements: {
    importId: string;
    bluebeamToolName: string;
    ageroRef: string | null;
    referenceItemId: string | null;
    measurementValue: number;
    unit: string;
    drawingSheet: string | null;
    layerName: string | null;
    mappingStatus: string;
  }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    const toolName = getCol(row, 'subject', 'label', 'tool_name', 'name', 'description');
    const qty = parseFloat(getCol(row, 'measurement', 'quantity', 'qty', 'length', 'area', 'count', 'total') || '0');
    const unit = getCol(row, 'unit', 'units') || 'EA';
    const sheet = getCol(row, 'page', 'sheet', 'drawing', 'page_label') || null;
    const layer = getCol(row, 'layer', 'space') || null;

    if (!toolName || isNaN(qty)) continue;

    // Try to parse agero_ref from subject field (format: DISPLAY NAME [AGERO_REF])
    let ageroRef: string | null = null;
    const refMatch = toolName.match(/\[([A-Z]{2}\.[A-Z]+\.[A-Z0-9]+)\]/);
    if (refMatch) ageroRef = refMatch[1];
    // Also try if subject IS the ref code
    else if (refByCode.has(toolName)) ageroRef = toolName;

    const refItem = ageroRef ? refByCode.get(ageroRef) ?? null : null;

    measurements.push({
      importId: importRecord.id,
      bluebeamToolName: toolName,
      ageroRef,
      referenceItemId: refItem?.id ?? null,
      measurementValue: qty,
      unit: refItem?.unit ?? unit,
      drawingSheet: sheet,
      layerName: layer,
      mappingStatus: refItem ? 'mapped' : 'pending',
    });
  }

  await prisma.takeoffMeasurement.createMany({ data: measurements });

  const mapped = measurements.filter((m) => m.mappingStatus === 'mapped').length;
  const unmapped = measurements.filter((m) => m.mappingStatus !== 'mapped').length;

  await prisma.takeoffImport.update({
    where: { id: importRecord.id },
    data: { mappedCount: mapped, unmappedCount: unmapped },
  });

  revalidatePath(`/leads/${estimateId}/takeoff`);
  return { importId: importRecord.id };
}

export async function updateMeasurementMapping(
  measurementId: string,
  status: 'mapped' | 'ignored',
  ageroRef?: string
) {
  await requireAppUser();
  await prisma.takeoffMeasurement.update({
    where: { id: measurementId },
    data: { mappingStatus: status, ageroRef: ageroRef ?? undefined },
  });
}

export async function confirmTakeoffImport(importId: string, estimateId: string) {
  const user = await requireAppUser();
  const estimate = await prisma.estimate.findFirst({
    where: { id: estimateId },
    include: {
      tradeSections: true,
    },
  });
  if (!estimate) return;

  const measurements = await prisma.takeoffMeasurement.findMany({
    where: { importId, mappingStatus: 'mapped' },
    include: { referenceItem: { include: { rates: { where: { rateType: 'standard' }, take: 1 } } } },
  });

  const scopeTemplates = await prisma.scopeTemplate.findMany({
    where: { organisationId: estimate.organisationId },
  });
  const scopeByRef = new Map(scopeTemplates.filter((s) => s.referenceItemId).map((s) => [s.referenceItemId!, s]));

  // Group measurements by ageroRef
  const grouped = new Map<string, { ref: typeof measurements[0]['referenceItem']; totalQty: number; unit: string }>();
  for (const m of measurements) {
    if (!m.ageroRef || !m.referenceItem) continue;
    const existing = grouped.get(m.ageroRef);
    if (existing) {
      existing.totalQty += Number(m.measurementValue);
    } else {
      grouped.set(m.ageroRef, {
        ref: m.referenceItem,
        totalQty: Number(m.measurementValue),
        unit: m.unit,
      });
    }
  }

  // Create/update estimate lines
  for (const [ageroRef, data] of grouped) {
    const { ref, totalQty, unit } = data;
    if (!ref) continue;

    const tradeCode = ref.tradeSectionCode;
    let tradeSection = estimate.tradeSections.find((ts) => ts.code === tradeCode);

    if (!tradeSection) {
      tradeSection = await prisma.estimateTradeSection.create({
        data: {
          estimateId,
          name: `${tradeCode} — ${ref.displayName.split(' ')[0]}`,
          code: tradeCode,
          order: estimate.tradeSections.length,
        },
      });
    }

    const stdRate = ref.rates[0] ? Number(ref.rates[0].unitCost) : 0;

    const existingLine = await prisma.estimateLine.findFirst({
      where: { estimateId, tradeSectionId: tradeSection.id, lineCode: ageroRef },
    });

    let lineId: string;
    if (existingLine) {
      await prisma.estimateLine.update({
        where: { id: existingLine.id },
        data: {
          quantity: { increment: totalQty },
          total: { increment: totalQty * stdRate },
        },
      });
      lineId = existingLine.id;
    } else {
      const newLine = await prisma.estimateLine.create({
        data: {
          estimateId,
          tradeSectionId: tradeSection.id,
          description: ref.displayName,
          lineCode: ageroRef,
          quantity: totalQty,
          unit,
          rate: stdRate,
          total: totalQty * stdRate,
          order: 0,
        },
      });
      lineId = newLine.id;

      // Auto-create scope from template
      const scopeTemplate = scopeByRef.get(ref.id);
      if (scopeTemplate) {
        await prisma.estimateLineScope.create({
          data: {
            estimateLineId: lineId,
            scopeText: scopeTemplate.scopeText
              .replace('{quantity}', totalQty.toFixed(2))
              .replace('{unit}', unit),
            isAutoGenerated: true,
          },
        });
      }
    }

    // Link measurements to line
    await prisma.takeoffMeasurement.updateMany({
      where: { importId, ageroRef },
      data: { mappedLineId: lineId, mappingStatus: 'mapped' },
    });
  }

  await prisma.takeoffImport.update({
    where: { id: importId },
    data: { importStatus: 'confirmed', confirmedById: user.id, confirmedAt: new Date() },
  });

  revalidatePath(`/leads/${estimateId}/takeoff`);
  revalidatePath(`/leads/${estimateId}/cost-plan`);
}
