'use server';

import { requireDirector } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { parseCatExport, CatRow } from '@/lib/cat-import/parser';
import { validateCatRows, ValidatedRow, ValidationResult } from '@/lib/cat-import/validator';
// ── In-memory session store (per-process; serverless-safe since we commit before redirect) ──

type PendingImport = {
  asAtDate: string;
  filename: string;
  fileSizeBytes: number;
  validatedRows: ValidatedRow[];
  warnings: ValidationResult[];
  errors: ValidationResult[];
};

const pendingImports = new Map<string, PendingImport>();

// ── Types returned to the client ─────────────────────────────────────────────

export type ParseResult = {
  ok: boolean;
  previewId?: string;
  rowCount?: number;
  skippedRows?: number;
  unmatchedHeaders?: string[];
  validatedRows?: SerializableValidatedRow[];
  errors?: SerializableValidation[];
  warnings?: SerializableValidation[];
  hasBlockingErrors?: boolean;
  existingImport?: ExistingImportMeta | null;
  error?: string;
};

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

export type CommitResult = {
  ok: boolean;
  importId?: string;
  isOverwrite?: boolean;
  rowsInserted?: number;
  rowsUpdated?: number;
  rowsSkipped?: number;
  error?: string;
};

// ── 1. Parse ─────────────────────────────────────────────────────────────────

export async function parseCatImport(
  formData: FormData,
): Promise<ParseResult> {
  await requireDirector();

  const file = formData.get('file') as File | null;
  const asAtDate = formData.get('asAtDate') as string | null;

  if (!file) return { ok: false, error: 'No file provided.' };
  if (!asAtDate) return { ok: false, error: 'No as-at date provided.' };

  // File type check
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!['csv', 'xlsx', 'xls'].includes(ext)) {
    return { ok: false, error: 'Only CSV and XLSX files are supported. PDFs are not supported.' };
  }

  // File size check (10 MB)
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: 'File is too large. CAT exports are typically under 100 KB.' };
  }

  // Date validation
  const asAt = new Date(asAtDate);
  if (isNaN(asAt.getTime())) return { ok: false, error: 'Invalid as-at date.' };
  if (asAt > new Date()) return { ok: false, error: 'As-at date cannot be in the future.' };

  // Parse
  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseCatExport(buffer, file.name);

  if (parsed.parseErrors.length > 0) {
    return { ok: false, error: parsed.parseErrors[0] };
  }

  if (parsed.rows.length === 0) {
    return { ok: false, error: 'No project rows found in the file.' };
  }

  // Load known job numbers and prior snapshots for validation
  const user = await requireDirector();
  const [financeProjects, priorSnapshots] = await Promise.all([
    prisma.financeProject.findMany({
      where: { organisationId: user.organisationId, deletedAt: null },
      select: { jobNumber: true },
    }),
    prisma.financeProjectSnapshot.findMany({
      where: { organisationId: user.organisationId },
      orderBy: { asAtDate: 'desc' },
      select: { jobNo: true, forecastContract: true, asAtDate: true },
    }),
  ]);

  const knownJobNos = new Set(financeProjects.map((p) => p.jobNumber?.trim() ?? '').filter(Boolean));

  // Build prior snapshot map: most recent snapshot per job
  const priorMap = new Map<string, { forecastContract: number }>();
  for (const snap of priorSnapshots) {
    const key = snap.jobNo.trim();
    if (!priorMap.has(key)) {
      priorMap.set(key, { forecastContract: Number(snap.forecastContract) });
    }
  }

  const validation = validateCatRows(parsed.rows, knownJobNos, priorMap);

  // Check for existing import on same date
  const existingSnap = await prisma.financeProjectSnapshot.findFirst({
    where: { organisationId: user.organisationId, asAtDate: asAt },
    include: { importedBy: { select: { firstName: true, lastName: true } } },
    orderBy: { importedAt: 'desc' },
  });

  let existingImport: ExistingImportMeta | null = null;
  if (existingSnap) {
    existingImport = {
      id: existingSnap.id,
      uploadedAt: existingSnap.importedAt.toISOString(),
      uploadedBy: `${existingSnap.importedBy.firstName} ${existingSnap.importedBy.lastName}`,
      sourceFilename: existingSnap.sourceFilename ?? '',
    };
  }

  // Store pending import
  const previewId = crypto.randomUUID();
  pendingImports.set(previewId, {
    asAtDate,
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
    validatedRows: validation.validatedRows as SerializableValidatedRow[],
    errors: validation.errors,
    warnings: validation.warnings,
    hasBlockingErrors: validation.hasBlockingErrors,
    existingImport,
  };
}

// ── 2. Commit ─────────────────────────────────────────────────────────────────

export async function commitCatImport(
  previewId: string,
  confirmOverwrite: boolean,
): Promise<CommitResult> {
  const user = await requireDirector();

  const pending = pendingImports.get(previewId);
  if (!pending) {
    return { ok: false, error: 'Import session expired. Please upload the file again.' };
  }

  if (pending.errors.length > 0) {
    return { ok: false, error: 'Cannot commit an import with blocking errors.' };
  }

  const asAt = new Date(pending.asAtDate);

  // Rows that pass validation (no errors)
  const goodRows = pending.validatedRows
    .filter((vr) => vr.status !== 'error')
    .map((vr) => vr.row);

  // Check for existing snapshots
  const existingSnapshots = await prisma.financeProjectSnapshot.findMany({
    where: { organisationId: user.organisationId, asAtDate: asAt },
    select: { id: true },
  });

  const isOverwrite = existingSnapshots.length > 0;
  if (isOverwrite && !confirmOverwrite) {
    return { ok: false, error: 'Overwrite confirmation required.' };
  }

  // Resolve financeProjectId for each row
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

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (isOverwrite) {
        await tx.financeProjectSnapshot.deleteMany({
          where: { organisationId: user.organisationId, asAtDate: asAt },
        });
      }

      // Create CatImport record
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

      // Insert snapshots
      for (const row of goodRows) {
        const financeProjectId = fpMap.get(row.jobNo.trim());
        if (!financeProjectId) {
          // Project not in Finance table — skip snapshot (unknown project, already warned)
          rowsSkipped++;
          continue;
        }

        const snapData = {
          organisationId: user.organisationId,
          financeProjectId,
          importedById: user.id,
          asAtDate: asAt,
          sourceFilename: pending.filename,
          status: row.status,
          jobNo: row.jobNo,
          projectName: row.projectName,
          practicalCompletion: row.practicalCompletion ? new Date(row.practicalCompletion) : null,
          forecastContract: row.forecastContract,
          forecastFinalCosts: row.forecastFinalCosts,
          forecastMargin: row.forecastMargin,
          roAdjust: row.roAdjust,
          marginInclRo: row.marginInclRo,
          forecastMarginPct: row.forecastMarginPct,
          claimTotal: row.claimTotal,
          claimRetention: row.claimRetention,
          subClaims: row.subClaims,
          subRetention: row.subRetention,
          creditors: row.creditors,
          labour: row.labour,
          plant: row.plant,
          stock: row.stock,
          totalCost: row.totalCost,
          billingLessCost: row.billingLessCost,
          marginToEarn: row.marginToEarn,
          marginRealised: row.marginRealised,
          wip: row.wip,
          overClaim: row.overClaim,
          nettRetention: row.nettRetention,
          nettCashFlow: row.nettCashFlow,
        };

        if (isOverwrite) {
          await tx.financeProjectSnapshot.create({ data: snapData });
          rowsUpdated++;
        } else {
          await tx.financeProjectSnapshot.create({ data: snapData });
          rowsInserted++;
        }
      }

      // Update row counts on catImport
      await tx.catImport.update({
        where: { id: catImport.id },
        data: {
          rowsInserted: isOverwrite ? 0 : rowsInserted,
          rowsUpdated: isOverwrite ? rowsUpdated : 0,
          rowsSkipped,
        },
      });

      return catImport;
    });

    pendingImports.delete(previewId);

    // Audit log
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
    };
  } catch (err) {
    console.error('[cat-import] commit failed:', err);
    return { ok: false, error: 'Import failed. No changes saved. Please try again.' };
  }
}

// ── 3. Cancel ────────────────────────────────────────────────────────────────

export async function cancelCatImport(previewId: string): Promise<void> {
  await requireDirector();
  pendingImports.delete(previewId);
}
