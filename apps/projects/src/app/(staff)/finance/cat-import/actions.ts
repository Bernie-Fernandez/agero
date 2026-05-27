'use server';

import { requireDirector } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { parseCatExport, CatRow } from '@/lib/cat-import/parser';
import { validateCatRows, ValidatedRow, ValidationResult } from '@/lib/cat-import/validator';

// ── In-memory session store ───────────────────────────────────────────────────
// Serverless-safe: the pending import is committed (or cancelled) before the
// user navigates away, so the same process always handles it.

type PendingImport = {
  asAtDate: string; // Set during parseCatImport (detected) or overridden via prepareCommit
  filename: string;
  fileSizeBytes: number;
  validatedRows: ValidatedRow[];
  warnings: ValidationResult[];
  errors: ValidationResult[];
};

const pendingImports = new Map<string, PendingImport>();

// ── Serialisable types returned to the client ─────────────────────────────────

export type SerializableValidation = {
  rowIndex: number;
  jobNo: string;
  projectName: string;
  severity: 'error' | 'warning';
  type: string;
  message: string;
};

export type SerializableValidatedRow = {
  row: CatRow;
  status: 'ok' | 'warning' | 'error';
  issues: SerializableValidation[];
};

export type ExistingImportMeta = {
  id: string;
  uploadedAt: string;
  uploadedBy: string;
  sourceFilename: string;
};

export type ParseResult = {
  ok: boolean;
  previewId?: string;
  rowCount?: number;
  skippedRows?: number;
  unmatchedHeaders?: string[];
  detectedAsAtDate?: string;
  validatedRows?: SerializableValidatedRow[];
  errors?: SerializableValidation[];
  warnings?: SerializableValidation[];
  hasBlockingErrors?: boolean;
  existingImport?: ExistingImportMeta | null;
  error?: string;
};

export type PrepareResult = {
  ok: boolean;
  existingImport?: ExistingImportMeta | null;
  error?: string;
};

export type SkippedProject = { jobNo: string; projectName: string };

export type CommitResult = {
  ok: boolean;
  importId?: string;
  isOverwrite?: boolean;
  rowsInserted?: number;
  rowsUpdated?: number;
  rowsSkipped?: number;
  skippedProjects?: SkippedProject[];
  reRunPreviewId?: string;
  error?: string;
  debug?: string;
};

// ── 1. Parse ─────────────────────────────────────────────────────────────────
// Parses the uploaded file, validates rows, stores a pending import in memory.
// Does NOT require an as-at date upfront — uses the date detected from the
// file's banner row. The user confirms/overrides the date in the wizard
// before calling prepareCommit.

export async function parseCatImport(formData: FormData): Promise<ParseResult> {
  await requireDirector();

  const file = formData.get('file') as File | null;
  if (!file) return { ok: false, error: 'No file provided.' };

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!['csv', 'xlsx', 'xls'].includes(ext)) {
    return { ok: false, error: 'Only CSV, XLS, and XLSX files are supported. PDFs are not supported.' };
  }

  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: 'File is too large. CAT exports are typically under 100 KB.' };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseCatExport(buffer, file.name);

  if (parsed.parseErrors.length > 0) {
    return { ok: false, error: parsed.parseErrors[0] };
  }

  if (parsed.rows.length === 0) {
    return { ok: false, error: 'No project rows found in the file.' };
  }

  const user = await requireDirector();

  const [financeProjects, priorSnapshots] = await Promise.all([
    prisma.financeProject.findMany({
      where: { organisationId: user.organisationId, deletedAt: null },
      select: { jobNumber: true },
    }),
    prisma.financeProjectSnapshot.findMany({
      where: { organisationId: user.organisationId },
      orderBy: { asAtDate: 'desc' },
      select: { jobNo: true, forecastContract: true },
    }),
  ]);

  const knownJobNos = new Set(
    financeProjects.map((p) => p.jobNumber?.trim() ?? '').filter(Boolean),
  );

  // Most recent snapshot per job for delta check
  const priorMap = new Map<string, { forecastContract: number }>();
  for (const snap of priorSnapshots) {
    const key = snap.jobNo.trim();
    if (!priorMap.has(key)) {
      priorMap.set(key, { forecastContract: Number(snap.forecastContract) });
    }
  }

  const validation = validateCatRows(parsed.rows, knownJobNos, priorMap);

  const previewId = crypto.randomUUID();
  pendingImports.set(previewId, {
    asAtDate: parsed.detectedAsAtDate ?? '',
    filename: file.name,
    fileSizeBytes: file.size,
    validatedRows: validation.validatedRows,
    warnings: validation.warnings,
    errors: validation.errors,
  });

  return {
    ok: true,
    previewId,
    rowCount: parsed.rows.length,
    skippedRows: parsed.skippedRows,
    unmatchedHeaders: parsed.unmatchedHeaders,
    detectedAsAtDate: parsed.detectedAsAtDate,
    validatedRows: validation.validatedRows as SerializableValidatedRow[],
    errors: validation.errors,
    warnings: validation.warnings,
    hasBlockingErrors: validation.hasBlockingErrors,
  };
}

// ── 2. Prepare commit ────────────────────────────────────────────────────────
// Called after the user confirms the as-at date in Step 2.
// Updates the pending import with the chosen date, checks for existing
// snapshots on that date, and returns overwrite metadata to the wizard.

export async function prepareCommit(
  previewId: string,
  asAtDate: string,
): Promise<PrepareResult> {
  const user = await requireDirector();

  const pending = pendingImports.get(previewId);
  if (!pending) {
    return { ok: false, error: 'Import session expired. Please upload the file again.' };
  }

  const asAt = new Date(asAtDate);
  if (isNaN(asAt.getTime())) return { ok: false, error: 'Invalid as-at date.' };
  if (asAt > new Date()) return { ok: false, error: 'As-at date cannot be in the future.' };

  // Update stored date
  pending.asAtDate = asAtDate;

  // Check for existing snapshots on this date
  const existingSnap = await prisma.financeProjectSnapshot.findFirst({
    where: { organisationId: user.organisationId, asAtDate: asAt },
    include: { importedBy: { select: { firstName: true, lastName: true } } },
    orderBy: { importedAt: 'desc' },
  });

  const existingImport: ExistingImportMeta | null = existingSnap
    ? {
        id: existingSnap.id,
        uploadedAt: existingSnap.importedAt.toISOString(),
        uploadedBy: `${existingSnap.importedBy.firstName} ${existingSnap.importedBy.lastName}`,
        sourceFilename: existingSnap.sourceFilename ?? '',
      }
    : null;

  return { ok: true, existingImport };
}

// ── 3. Commit ─────────────────────────────────────────────────────────────────

export async function commitCatImport(
  previewId: string,
  confirmOverwrite: boolean,
): Promise<CommitResult> {
  const user = await requireDirector();

  const pending = pendingImports.get(previewId);
  if (!pending) {
    return { ok: false, error: 'Import session expired. Please upload the file again.' };
  }

  if (!pending.asAtDate) {
    return { ok: false, error: 'As-at date not set. Please go back and confirm the date.' };
  }

  if (pending.errors.length > 0) {
    return { ok: false, error: 'Cannot commit an import with blocking errors.' };
  }

  const asAt = new Date(pending.asAtDate);

  const goodRows = pending.validatedRows
    .filter((vr) => vr.status !== 'error')
    .map((vr) => vr.row);

  const existingSnapshots = await prisma.financeProjectSnapshot.findMany({
    where: { organisationId: user.organisationId, asAtDate: asAt },
    select: { id: true },
  });

  const isOverwrite = existingSnapshots.length > 0;
  if (isOverwrite && !confirmOverwrite) {
    return { ok: false, error: 'Overwrite confirmation required.' };
  }

  const financeProjects = await prisma.financeProject.findMany({
    where: { organisationId: user.organisationId, deletedAt: null },
    select: { id: true, jobNumber: true },
  });
  const fpMap = new Map<string, string>();
  for (const fp of financeProjects) {
    if (fp.jobNumber) fpMap.set(fp.jobNumber.trim(), fp.id);
  }

  let rowsInserted = 0;
  let rowsUpdated = 0;
  let rowsSkipped = 0;
  const skippedProjectsList: SkippedProject[] = [];

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (isOverwrite) {
        await tx.financeProjectSnapshot.deleteMany({
          where: { organisationId: user.organisationId, asAtDate: asAt },
        });
      }

      const catImport = await tx.catImport.create({
        data: {
          organisationId: user.organisationId,
          asAtDate: asAt,
          uploadedById: user.id,
          sourceFilename: pending.filename,
          fileSizeBytes: pending.fileSizeBytes,
          rowsTotal: pending.validatedRows.length,
          status: 'committed',
          validationWarnings: pending.warnings as never,
          isOverwrite,
        },
      });

      for (const row of goodRows) {
        const financeProjectId = fpMap.get(row.jobNo.trim());
        if (!financeProjectId) {
          rowsSkipped++;
          skippedProjectsList.push({ jobNo: row.jobNo, projectName: row.projectName });
          continue;
        }

        const snapData = {
          organisationId: user.organisationId,
          financeProjectId,
          importedById: user.id,
          asAtDate: asAt,
          sourceFilename: pending.filename,
          // Awarded/Backlog classification is manual (Sprint X.2). Stored blank for now.
          status: '',
          jobNo: row.jobNo,
          projectName: row.projectName,
          practicalCompletion: row.practicalCompletion ? new Date(row.practicalCompletion) : null,
          forecastContract:  row.forecastContract,
          forecastFinalCosts: row.forecastFinalCosts,
          forecastMargin:    row.forecastMargin,
          roAdjust:          row.roAdjust,
          marginInclRo:      row.marginInclRo,
          forecastMarginPct: row.forecastMarginPct,
          claimTotal:        row.claimTotal,
          claimRetention:    row.claimRetention,
          subClaims:         row.subClaims,
          subRetention:      row.subRetention,
          creditors:         row.creditors,
          labour:            row.labour,
          plant:             row.plant,
          stock:             row.stock,
          totalCost:         row.totalCost,
          billingLessCost:   row.billingLessCost,
          marginToEarn:      row.marginToEarn,
          marginRealised:    row.marginRealised,
          wip:               row.wip,
          overClaim:         row.overClaim,
          nettRetention:     row.nettRetention,
          nettCashFlow:      row.nettCashFlow,
        };

        await tx.financeProjectSnapshot.create({ data: snapData });
        if (isOverwrite) rowsUpdated++; else rowsInserted++;
      }

      await tx.catImport.update({
        where: { id: catImport.id },
        data: {
          rowsInserted: isOverwrite ? 0 : rowsInserted,
          rowsUpdated:  isOverwrite ? rowsUpdated : 0,
          rowsSkipped,
        },
      });

      return catImport;
    }, { maxWait: 10000, timeout: 30000 });

    // Keep pending import alive when rows were skipped so the user can re-run
    // after adding the missing Finance Project records.
    if (rowsSkipped === 0) {
      pendingImports.delete(previewId);
    }

    await createAuditLog({
      userId: user.id,
      action: isOverwrite ? 'CAT_IMPORT_OVERWRITTEN' : 'CAT_IMPORT_COMMITTED',
      entity: 'CatImport',
      entityId: result.id,
      detail: {
        as_at_date: pending.asAtDate,
        source_filename: pending.filename,
        rows_inserted: rowsInserted,
        rows_updated: rowsUpdated,
        rows_skipped: rowsSkipped,
        warning_count: pending.warnings.length,
        is_overwrite: isOverwrite,
      },
    });

    return {
      ok: true,
      importId: result.id,
      isOverwrite,
      rowsInserted,
      rowsUpdated,
      rowsSkipped,
      skippedProjects: skippedProjectsList.length > 0 ? skippedProjectsList : undefined,
      reRunPreviewId: rowsSkipped > 0 ? previewId : undefined,
    };
  } catch (err) {
    console.error('[cat-import] commit failed:', err);
    return {
      ok: false,
      error: 'Import failed. No changes saved. Please try again.',
      debug: process.env.NODE_ENV !== 'production' ? String(err) : undefined,
    };
  }
}

// ── 4. Cancel ─────────────────────────────────────────────────────────────────

export async function cancelCatImport(previewId: string): Promise<void> {
  await requireDirector();
  pendingImports.delete(previewId);
}
