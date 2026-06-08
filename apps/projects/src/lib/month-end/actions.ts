'use server';

import { requireDirector } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { getRefreshedXeroClient } from '@/lib/xero/client';
import { pullXeroPnLMonth } from '@/lib/xero/sync';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MonthEndRow = {
  id: string;
  reportMonth: string;       // ISO date string, first of month
  status: string;
  markedReadyAt: string | null;
  markedReadyByName: string | null;
  catImportId: string | null;
  catImportDate: string | null;   // asAtDate of the linked CatImport
  wipCalculatedAt: string | null;
  wipNetMovement: string | null;
  wipReviewedAt: string | null;
  xeroJournalId: string | null;
  xeroJournalPostedAt: string | null;
  xeroResyncedAt: string | null;
  lockedAt: string | null;
  lockNotes: string | null;
  // staleness: true if latest CAT snapshot for this month is not in-month
  catStale: boolean;
};

export type WipLineRow = {
  id: string;
  financeProjectId: string;
  jobNo: string;
  projectName: string;
  catWip: string;
  catBillingLessCost: string;
  catMarginRealised: string;
  catClaimTotal: string;
  catTotalCost: string;
  priorMonthWip: string;
  wipMovement: string;
  overrideWip: string | null;
  overrideReason: string | null;
  effectiveWip: string;
  effectiveMovement: string;
};

export type WipReviewData = {
  monthEnd: MonthEndRow;
  lines: WipLineRow[];
  priorNetWip: string;
  thisNetWip: string;
  netMovement: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lastDayOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function firstDayOfPriorMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
}

function fmtMonthYear(date: Date): string {
  return date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// ─── List + auto-seed ─────────────────────────────────────────────────────────

export async function listMonthEndStatuses(): Promise<{ ok: boolean; rows?: MonthEndRow[]; error?: string }> {
  const user = await requireDirector();
  try {
    // Auto-seed: ensure FY26 rows exist (Jul 2025 – Jun 2026)
    const fy26Months: Date[] = [];
    for (let m = 0; m < 12; m++) {
      fy26Months.push(new Date(Date.UTC(2025, 6 + m, 1))); // Jul 2025 = month index 6
    }
    // Wrap around: months 12+ overflow to next year
    const seedMonths = [
      new Date(Date.UTC(2025, 6, 1)),
      new Date(Date.UTC(2025, 7, 1)),
      new Date(Date.UTC(2025, 8, 1)),
      new Date(Date.UTC(2025, 9, 1)),
      new Date(Date.UTC(2025, 10, 1)),
      new Date(Date.UTC(2025, 11, 1)),
      new Date(Date.UTC(2026, 0, 1)),
      new Date(Date.UTC(2026, 1, 1)),
      new Date(Date.UTC(2026, 2, 1)),
      new Date(Date.UTC(2026, 3, 1)),
      new Date(Date.UTC(2026, 4, 1)),
      new Date(Date.UTC(2026, 5, 1)),
    ];
    void fy26Months; // silence lint
    await prisma.monthEndStatus.createMany({
      data: seedMonths.map((d) => ({
        organisationId: user.organisationId,
        reportMonth: d,
        status: 'OPEN',
      })),
      skipDuplicates: true,
    });

    const rows = await prisma.monthEndStatus.findMany({
      where: { organisationId: user.organisationId },
      orderBy: { reportMonth: 'desc' },
      include: {
        markedReadyBy: { select: { firstName: true, lastName: true } },
      },
    });

    // Get latest CatImport per month to check staleness
    const catImports = await prisma.catImport.findMany({
      where: { organisationId: user.organisationId },
      orderBy: { uploadedAt: 'desc' },
    });

    const result: MonthEndRow[] = rows.map((r) => {
      // Find most recent cat import for this month's report period
      const reportDate = new Date(r.reportMonth);
      const monthStart = new Date(Date.UTC(reportDate.getUTCFullYear(), reportDate.getUTCMonth(), 1));
      const monthEnd = lastDayOfMonth(reportDate);
      const relevantImport = catImports.find(
        (ci) => new Date(ci.asAtDate) >= monthStart && new Date(ci.asAtDate) <= monthEnd,
      );
      const catStale = !relevantImport && r.status !== 'OPEN';

      return {
        id: r.id,
        reportMonth: r.reportMonth.toISOString(),
        status: r.status,
        markedReadyAt: r.markedReadyAt?.toISOString() ?? null,
        markedReadyByName: r.markedReadyBy
          ? `${r.markedReadyBy.firstName} ${r.markedReadyBy.lastName}`
          : null,
        catImportId: r.catImportId ?? null,
        catImportDate: relevantImport?.asAtDate.toISOString() ?? null,
        wipCalculatedAt: r.wipCalculatedAt?.toISOString() ?? null,
        wipNetMovement: r.wipNetMovement?.toString() ?? null,
        wipReviewedAt: r.wipReviewedAt?.toISOString() ?? null,
        xeroJournalId: r.xeroJournalId ?? null,
        xeroJournalPostedAt: r.xeroJournalPostedAt?.toISOString() ?? null,
        xeroResyncedAt: r.xeroResyncedAt?.toISOString() ?? null,
        lockedAt: r.lockedAt?.toISOString() ?? null,
        lockNotes: r.lockNotes ?? null,
        catStale,
      };
    });

    return { ok: true, rows: result };
  } catch (e) {
    console.error('[month-end] listMonthEndStatuses:', e);
    return { ok: false, error: 'Failed to load month-end statuses.' };
  }
}

// ─── Mark Ready ───────────────────────────────────────────────────────────────

export async function markReady(
  monthEndId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  try {
    const record = await prisma.monthEndStatus.findUnique({ where: { id: monthEndId } });
    if (!record || record.organisationId !== user.organisationId) {
      return { ok: false, error: 'Month not found.' };
    }
    if (record.status !== 'OPEN') {
      return { ok: false, error: 'Month is not in OPEN status.' };
    }

    // Find most recent CatImport for this month
    const reportDate = new Date(record.reportMonth);
    const monthStart = new Date(Date.UTC(reportDate.getUTCFullYear(), reportDate.getUTCMonth(), 1));
    const monthEnd = lastDayOfMonth(reportDate);
    const latestImport = await prisma.catImport.findFirst({
      where: {
        organisationId: user.organisationId,
        asAtDate: { gte: monthStart, lte: monthEnd },
      },
      orderBy: { uploadedAt: 'desc' },
    });

    await prisma.monthEndStatus.update({
      where: { id: monthEndId },
      data: {
        status: 'READY',
        markedReadyById: user.id,
        markedReadyAt: new Date(),
        catImportId: latestImport?.id ?? null,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: 'MONTH_END_MARKED_READY',
      entity: 'MonthEndStatus',
      entityId: monthEndId,
      detail: { report_month: record.reportMonth.toISOString() },
    });

    return { ok: true };
  } catch (e) {
    console.error('[month-end] markReady:', e);
    return { ok: false, error: 'Failed to mark month as ready.' };
  }
}

// ─── Calculate WIP ────────────────────────────────────────────────────────────

export async function calculateWip(
  monthEndId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  try {
    const record = await prisma.monthEndStatus.findUnique({ where: { id: monthEndId } });
    if (!record || record.organisationId !== user.organisationId) {
      return { ok: false, error: 'Month not found.' };
    }
    if (record.status !== 'READY' && record.status !== 'WIP_CALCULATED') {
      return { ok: false, error: 'Month must be in READY or WIP_CALCULATED status.' };
    }

    const reportDate = new Date(record.reportMonth);
    const monthEnd = lastDayOfMonth(reportDate);
    const priorMonthDate = firstDayOfPriorMonth(reportDate);

    // Active projects for this org
    const projects = await prisma.financeProject.findMany({
      where: { organisationId: user.organisationId, deletedAt: null },
      select: { id: true, jobNumber: true, projectName: true },
    });

    // Latest snapshot per project on or before end of report month
    const snapshots = await prisma.financeProjectSnapshot.findMany({
      where: {
        organisationId: user.organisationId,
        asAtDate: { lte: monthEnd },
      },
      orderBy: { asAtDate: 'desc' },
    });
    // Keep only the latest snapshot per project
    const latestSnap = new Map<string, typeof snapshots[0]>();
    for (const snap of snapshots) {
      if (!latestSnap.has(snap.financeProjectId)) {
        latestSnap.set(snap.financeProjectId, snap);
      }
    }

    // Prior month WIP per project from the previous MonthEndStatus
    const priorMonthEnd = await prisma.monthEndStatus.findUnique({
      where: {
        organisationId_reportMonth: {
          organisationId: user.organisationId,
          reportMonth: priorMonthDate,
        },
      },
      include: { wipProjectLines: true },
    });
    const priorWipMap = new Map<string, number>();
    if (priorMonthEnd) {
      for (const line of priorMonthEnd.wipProjectLines) {
        priorWipMap.set(line.financeProjectId, Number(line.effectiveWip));
      }
    }

    // Delete existing WipProjectLines for this month (recalculate)
    await prisma.wipProjectLine.deleteMany({ where: { monthEndStatusId: monthEndId } });

    const lines: {
      monthEndStatusId: string;
      financeProjectId: string;
      jobNo: string;
      projectName: string;
      catWip: number;
      catBillingLessCost: number;
      catMarginRealised: number;
      catClaimTotal: number;
      catTotalCost: number;
      priorMonthWip: number;
      wipMovement: number;
      effectiveWip: number;
      effectiveMovement: number;
    }[] = [];

    for (const proj of projects) {
      const snap = latestSnap.get(proj.id);
      if (!snap) continue; // Skip projects with no snapshot data

      const catWip = Number(snap.wip);
      const catBillingLessCost = Number(snap.billingLessCost ?? 0);
      const catMarginRealised = Number(snap.marginRealised ?? 0);
      const catClaimTotal = Number(snap.claimTotal);
      const catTotalCost = Number(snap.totalCost);
      const priorMonthWip = priorWipMap.get(proj.id) ?? 0;
      const wipMovement = catWip - priorMonthWip;
      const effectiveWip = catWip;
      const effectiveMovement = wipMovement;

      lines.push({
        monthEndStatusId: monthEndId,
        financeProjectId: proj.id,
        jobNo: proj.jobNumber,
        projectName: proj.projectName,
        catWip,
        catBillingLessCost,
        catMarginRealised,
        catClaimTotal,
        catTotalCost,
        priorMonthWip,
        wipMovement,
        effectiveWip,
        effectiveMovement,
      });
    }

    await prisma.wipProjectLine.createMany({ data: lines });

    const netMovement = lines.reduce((s, l) => s + l.effectiveMovement, 0);
    const roundedNet = Math.round(netMovement * 100) / 100;

    await prisma.monthEndStatus.update({
      where: { id: monthEndId },
      data: {
        status: 'WIP_CALCULATED',
        wipCalculatedAt: new Date(),
        wipNetMovement: roundedNet,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: 'MONTH_END_WIP_CALCULATED',
      entity: 'MonthEndStatus',
      entityId: monthEndId,
      detail: {
        report_month: record.reportMonth.toISOString(),
        net_movement: roundedNet,
        project_count: lines.length,
      },
    });

    return { ok: true };
  } catch (e) {
    console.error('[month-end] calculateWip:', e);
    return { ok: false, error: 'Failed to calculate WIP.' };
  }
}

// ─── Get WIP Review Data ──────────────────────────────────────────────────────

export async function getWipReview(monthEndId: string): Promise<{
  ok: boolean;
  data?: WipReviewData;
  error?: string;
}> {
  const user = await requireDirector();
  try {
    const record = await prisma.monthEndStatus.findUnique({
      where: { id: monthEndId },
      include: {
        wipProjectLines: { orderBy: [{ jobNo: 'asc' }] },
        markedReadyBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!record || record.organisationId !== user.organisationId) {
      return { ok: false, error: 'Month not found.' };
    }

    const serialized = JSON.parse(JSON.stringify(record));
    const lines: WipLineRow[] = serialized.wipProjectLines.map((l: Record<string, unknown>) => ({
      id: l.id as string,
      financeProjectId: l.financeProjectId as string,
      jobNo: l.jobNo as string,
      projectName: l.projectName as string,
      catWip: String(l.catWip),
      catBillingLessCost: String(l.catBillingLessCost),
      catMarginRealised: String(l.catMarginRealised),
      catClaimTotal: String(l.catClaimTotal),
      catTotalCost: String(l.catTotalCost),
      priorMonthWip: String(l.priorMonthWip),
      wipMovement: String(l.wipMovement),
      overrideWip: l.overrideWip != null ? String(l.overrideWip) : null,
      overrideReason: (l.overrideReason as string | null) ?? null,
      effectiveWip: String(l.effectiveWip),
      effectiveMovement: String(l.effectiveMovement),
    }));

    const priorNetWip = lines.reduce((s, l) => s + Number(l.priorMonthWip), 0);
    const thisNetWip = lines.reduce((s, l) => s + Number(l.effectiveWip), 0);
    const netMovement = thisNetWip - priorNetWip;

    const reportDate = new Date(record.reportMonth);
    const catImportDate = record.catImportId
      ? (await prisma.catImport.findUnique({ where: { id: record.catImportId }, select: { asAtDate: true } }))?.asAtDate?.toISOString() ?? null
      : null;

    const monthEnd: MonthEndRow = {
      id: record.id,
      reportMonth: record.reportMonth.toISOString(),
      status: record.status,
      markedReadyAt: record.markedReadyAt?.toISOString() ?? null,
      markedReadyByName: record.markedReadyBy
        ? `${record.markedReadyBy.firstName} ${record.markedReadyBy.lastName}`
        : null,
      catImportId: record.catImportId ?? null,
      catImportDate,
      wipCalculatedAt: record.wipCalculatedAt?.toISOString() ?? null,
      wipNetMovement: record.wipNetMovement?.toString() ?? null,
      wipReviewedAt: record.wipReviewedAt?.toISOString() ?? null,
      xeroJournalId: record.xeroJournalId ?? null,
      xeroJournalPostedAt: record.xeroJournalPostedAt?.toISOString() ?? null,
      xeroResyncedAt: record.xeroResyncedAt?.toISOString() ?? null,
      lockedAt: record.lockedAt?.toISOString() ?? null,
      lockNotes: record.lockNotes ?? null,
      catStale: false,
    };
    void reportDate;

    return {
      ok: true,
      data: {
        monthEnd,
        lines,
        priorNetWip: priorNetWip.toFixed(2),
        thisNetWip: thisNetWip.toFixed(2),
        netMovement: netMovement.toFixed(2),
      },
    };
  } catch (e) {
    console.error('[month-end] getWipReview:', e);
    return { ok: false, error: 'Failed to load WIP review.' };
  }
}

// ─── Override WIP ─────────────────────────────────────────────────────────────

export async function overrideWipLine(input: {
  wipLineId: string;
  overrideWip: number;
  overrideReason: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  try {
    const line = await prisma.wipProjectLine.findUnique({
      where: { id: input.wipLineId },
      include: { monthEndStatus: true },
    });
    if (!line || line.monthEndStatus.organisationId !== user.organisationId) {
      return { ok: false, error: 'WIP line not found.' };
    }

    const priorMonthWip = Number(line.priorMonthWip);
    const effectiveWip = input.overrideWip;
    const effectiveMovement = effectiveWip - priorMonthWip;

    await prisma.wipProjectLine.update({
      where: { id: input.wipLineId },
      data: {
        overrideWip: input.overrideWip,
        overrideReason: input.overrideReason,
        effectiveWip,
        effectiveMovement,
      },
    });

    // Recalculate net movement on the MonthEndStatus
    const allLines = await prisma.wipProjectLine.findMany({
      where: { monthEndStatusId: line.monthEndStatusId },
    });
    const netMovement = allLines.reduce((s, l) => s + Number(l.effectiveMovement), 0);
    await prisma.monthEndStatus.update({
      where: { id: line.monthEndStatusId },
      data: { wipNetMovement: Math.round(netMovement * 100) / 100 },
    });

    return { ok: true };
  } catch (e) {
    console.error('[month-end] overrideWipLine:', e);
    return { ok: false, error: 'Failed to apply override.' };
  }
}

// ─── Approve WIP Review ───────────────────────────────────────────────────────

export async function approveWipReview(
  monthEndId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  try {
    const record = await prisma.monthEndStatus.findUnique({ where: { id: monthEndId } });
    if (!record || record.organisationId !== user.organisationId) {
      return { ok: false, error: 'Month not found.' };
    }
    if (record.status !== 'WIP_CALCULATED') {
      return { ok: false, error: 'Month must be in WIP_CALCULATED status.' };
    }

    await prisma.monthEndStatus.update({
      where: { id: monthEndId },
      data: {
        status: 'WIP_REVIEWED',
        wipReviewedById: user.id,
        wipReviewedAt: new Date(),
      },
    });

    await createAuditLog({
      userId: user.id,
      action: 'MONTH_END_WIP_REVIEWED',
      entity: 'MonthEndStatus',
      entityId: monthEndId,
      detail: { report_month: record.reportMonth.toISOString(), net_movement: record.wipNetMovement?.toString() },
    });

    return { ok: true };
  } catch (e) {
    console.error('[month-end] approveWipReview:', e);
    return { ok: false, error: 'Failed to approve WIP review.' };
  }
}

// ─── Post to Xero ─────────────────────────────────────────────────────────────

export async function postWipJournalToXero(
  monthEndId: string,
): Promise<{ ok: boolean; journalId?: string; error?: string }> {
  const user = await requireDirector();
  try {
    const record = await prisma.monthEndStatus.findUnique({
      where: { id: monthEndId },
      include: { wipProjectLines: { orderBy: [{ jobNo: 'asc' }] } },
    });
    if (!record || record.organisationId !== user.organisationId) {
      return { ok: false, error: 'Month not found.' };
    }
    if (record.status !== 'WIP_REVIEWED') {
      return { ok: false, error: 'Month must be in WIP_REVIEWED status.' };
    }

    // Get WIP account codes
    const wipSettings = await prisma.xeroWipSettings.findUnique({
      where: { organisationId: user.organisationId },
    });
    const openingCode = wipSettings?.openingWipAccountCode ?? '330';
    const closingCode = wipSettings?.closingWipAccountCode ?? '370';

    const xero = await getRefreshedXeroClient(user.organisationId);
    if (!xero) return { ok: false, error: 'Xero is not connected. Please reconnect in Settings.' };
    const tenantId = xero.tenants[0]?.tenantId;
    if (!tenantId) return { ok: false, error: 'No Xero tenant found.' };

    const reportDate = new Date(record.reportMonth);
    const journalDate = lastDayOfMonth(reportDate);
    const journalDateStr = journalDate.toISOString().split('T')[0];
    const monthYear = fmtMonthYear(reportDate);

    // Build journal lines: Dr Closing WIP (370) and Cr Opening WIP (330) per project
    const journalLines: {
      lineAmount: number;
      accountCode: string;
      description: string;
      taxType: string;
    }[] = [];

    for (const line of record.wipProjectLines) {
      const effectiveWip = Number(line.effectiveWip);
      const priorWip = Number(line.priorMonthWip);
      const label = `${line.jobNo} ${line.projectName}`;

      journalLines.push({
        lineAmount: effectiveWip,
        accountCode: closingCode,
        description: `${label} — Closing WIP ${monthYear}`,
        taxType: 'NONE',
      });
      journalLines.push({
        lineAmount: -priorWip,
        accountCode: openingCode,
        description: `${label} — Opening WIP ${monthYear}`,
        taxType: 'NONE',
      });
    }

    // Xero requires journals to balance (sum = 0)
    const journalSum = journalLines.reduce((s, l) => s + l.lineAmount, 0);
    if (Math.abs(journalSum) > 0.01) {
      return {
        ok: false,
        error: `Journal does not balance — net ${journalSum.toFixed(2)}. Confirm WIP account structure with your accountant before posting.`,
      };
    }

    // Post to Xero using the xero-node SDK
    const { ManualJournal } = await import('xero-node');
    const payload = {
      manualJournals: [
        {
          narration: `WIP adjustment — ${monthYear} — Agero ERP`,
          date: journalDateStr,
          status: ManualJournal.StatusEnum.POSTED,
          journalLines: journalLines.map((l) => ({
            lineAmount: l.lineAmount,
            accountCode: l.accountCode,
            description: l.description,
            taxType: l.taxType,
          })),
        },
      ],
    };

    const response = await xero.accountingApi.createManualJournals(tenantId, payload);
    const journalId = response.body.manualJournals?.[0]?.manualJournalID;
    if (!journalId) {
      return { ok: false, error: 'Xero did not return a journal ID.' };
    }

    await prisma.monthEndStatus.update({
      where: { id: monthEndId },
      data: {
        status: 'JOURNAL_POSTED',
        xeroJournalId: journalId,
        xeroJournalPostedAt: new Date(),
        xeroJournalPostedById: user.id,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: 'MONTH_END_JOURNAL_POSTED',
      entity: 'MonthEndStatus',
      entityId: monthEndId,
      detail: {
        report_month: record.reportMonth.toISOString(),
        xero_journal_id: journalId,
        net_movement: record.wipNetMovement?.toString(),
      },
    });

    return { ok: true, journalId };
  } catch (e) {
    console.error('[month-end] postWipJournalToXero:', e);
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Failed to post journal to Xero: ${msg}` };
  }
}

// ─── Re-sync Xero ─────────────────────────────────────────────────────────────

export async function resyncXero(
  monthEndId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  try {
    const record = await prisma.monthEndStatus.findUnique({ where: { id: monthEndId } });
    if (!record || record.organisationId !== user.organisationId) {
      return { ok: false, error: 'Month not found.' };
    }
    if (record.status !== 'JOURNAL_POSTED') {
      return { ok: false, error: 'Month must be in JOURNAL_POSTED status.' };
    }

    const reportDate = new Date(record.reportMonth);
    const month = reportDate.getUTCMonth() + 1; // 1-based
    const year = reportDate.getUTCFullYear();

    const result = await pullXeroPnLMonth(month, year, user.id);
    if (!result.ok) {
      return { ok: false, error: result.error ?? 'Xero P&L sync failed.' };
    }

    await prisma.monthEndStatus.update({
      where: { id: monthEndId },
      data: {
        status: 'XERO_RESYNCED',
        xeroResyncedAt: new Date(),
        xeroSyncedAt: new Date(),
      },
    });

    await createAuditLog({
      userId: user.id,
      action: 'MONTH_END_XERO_RESYNCED',
      entity: 'MonthEndStatus',
      entityId: monthEndId,
      detail: { report_month: record.reportMonth.toISOString() },
    });

    return { ok: true };
  } catch (e) {
    console.error('[month-end] resyncXero:', e);
    return { ok: false, error: 'Failed to re-sync Xero P&L.' };
  }
}

// ─── Lock Month ───────────────────────────────────────────────────────────────

export async function lockMonth(input: {
  monthEndId: string;
  lockNotes?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  try {
    const record = await prisma.monthEndStatus.findUnique({ where: { id: input.monthEndId } });
    if (!record || record.organisationId !== user.organisationId) {
      return { ok: false, error: 'Month not found.' };
    }
    if (record.status !== 'XERO_RESYNCED') {
      return { ok: false, error: 'Month must be in XERO_RESYNCED status.' };
    }

    await prisma.monthEndStatus.update({
      where: { id: input.monthEndId },
      data: {
        status: 'LOCKED',
        lockedAt: new Date(),
        lockedById: user.id,
        lockNotes: input.lockNotes ?? null,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: 'MONTH_END_LOCKED',
      entity: 'MonthEndStatus',
      entityId: input.monthEndId,
      detail: {
        report_month: record.reportMonth.toISOString(),
        lock_notes: input.lockNotes ?? null,
      },
    });

    return { ok: true };
  } catch (e) {
    console.error('[month-end] lockMonth:', e);
    return { ok: false, error: 'Failed to lock month.' };
  }
}

// ─── XeroWipSettings ──────────────────────────────────────────────────────────

export async function getXeroWipSettings(): Promise<{
  ok: boolean;
  settings?: { openingWipAccountCode: string; closingWipAccountCode: string };
  error?: string;
}> {
  const user = await requireDirector();
  try {
    const settings = await prisma.xeroWipSettings.findUnique({
      where: { organisationId: user.organisationId },
    });
    return {
      ok: true,
      settings: {
        openingWipAccountCode: settings?.openingWipAccountCode ?? '330',
        closingWipAccountCode: settings?.closingWipAccountCode ?? '370',
      },
    };
  } catch (e) {
    console.error('[month-end] getXeroWipSettings:', e);
    return { ok: false, error: 'Failed to load settings.' };
  }
}

export async function saveXeroWipSettings(input: {
  openingWipAccountCode: string;
  closingWipAccountCode: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await requireDirector();
  try {
    await prisma.xeroWipSettings.upsert({
      where: { organisationId: user.organisationId },
      update: {
        openingWipAccountCode: input.openingWipAccountCode,
        closingWipAccountCode: input.closingWipAccountCode,
      },
      create: {
        organisationId: user.organisationId,
        openingWipAccountCode: input.openingWipAccountCode,
        closingWipAccountCode: input.closingWipAccountCode,
      },
    });
    return { ok: true };
  } catch (e) {
    console.error('[month-end] saveXeroWipSettings:', e);
    return { ok: false, error: 'Failed to save settings.' };
  }
}
