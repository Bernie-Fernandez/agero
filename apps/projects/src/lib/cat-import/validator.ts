import { CatRow } from './parser';

export type ValidationSeverity = 'error' | 'warning';

export type ValidationResult = {
  rowIndex: number;
  jobNo: string;
  projectName: string;
  severity: ValidationSeverity;
  type: string;
  message: string;
};

export type RowValidationStatus = 'ok' | 'warning' | 'error';

export type ValidatedRow = {
  row: CatRow;
  status: RowValidationStatus;
  issues: ValidationResult[];
};

export type ValidationSummary = {
  validatedRows: ValidatedRow[];
  errors: ValidationResult[];
  warnings: ValidationResult[];
  hasBlockingErrors: boolean;
};

const DELTA_THRESHOLD = 0.20;

export function validateCatRows(
  rows: CatRow[],
  knownJobNos: Set<string>,
  priorSnapshots: Map<string, { forecastContract: number }>,
): ValidationSummary {
  const errors: ValidationResult[] = [];
  const warnings: ValidationResult[] = [];
  const validatedRows: ValidatedRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowIssues: ValidationResult[] = [];

    // Error: Job No present
    if (!row.jobNo || !row.jobNo.trim()) {
      const issue: ValidationResult = {
        rowIndex: i + 1,
        jobNo: '',
        projectName: row.projectName,
        severity: 'error',
        type: 'MISSING_JOB_NO',
        message: 'Job No is missing — row will be skipped.',
      };
      rowIssues.push(issue);
      errors.push(issue);
      validatedRows.push({ row, status: 'error', issues: rowIssues });
      continue;
    }

    // Error: Forecast Contract not negative
    if (row.forecastContract < 0) {
      const issue: ValidationResult = {
        rowIndex: i + 1,
        jobNo: row.jobNo,
        projectName: row.projectName,
        severity: 'error',
        type: 'NEGATIVE_CONTRACT',
        message: `Forecast Contract is negative (${row.forecastContract}) — row will be skipped.`,
      };
      rowIssues.push(issue);
      errors.push(issue);
      validatedRows.push({ row, status: 'error', issues: rowIssues });
      continue;
    }

    // Warning: Job No exists in Finance Project table
    if (!knownJobNos.has(row.jobNo.trim())) {
      const issue: ValidationResult = {
        rowIndex: i + 1,
        jobNo: row.jobNo,
        projectName: row.projectName,
        severity: 'warning',
        type: 'UNKNOWN_JOB_NO',
        message: `Job No "${row.jobNo}" not found in the Finance Project table — will be imported but flagged for review.`,
      };
      rowIssues.push(issue);
      warnings.push(issue);
    }

    // Warning: Margin math check (±$1 tolerance for CAT rounding)
    const expectedMargin = row.forecastContract - row.forecastFinalCosts;
    if (Math.abs(expectedMargin - row.forecastMargin) > 1) {
      const issue: ValidationResult = {
        rowIndex: i + 1,
        jobNo: row.jobNo,
        projectName: row.projectName,
        severity: 'warning',
        type: 'MARGIN_MATH',
        message: `Forecast Margin (${row.forecastMargin.toFixed(0)}) does not match Contract − Costs (${expectedMargin.toFixed(0)}). Values imported as given.`,
      };
      rowIssues.push(issue);
      warnings.push(issue);
    }

    // Warning: Total Cost math check (±$1 tolerance)
    const expectedTotal = row.subClaims + row.creditors + row.labour + row.plant + row.stock;
    if (Math.abs(expectedTotal - row.totalCost) > 1) {
      const issue: ValidationResult = {
        rowIndex: i + 1,
        jobNo: row.jobNo,
        projectName: row.projectName,
        severity: 'warning',
        type: 'TOTAL_COST_MATH',
        message: `Total Cost (${row.totalCost.toFixed(0)}) does not match sum of components (${expectedTotal.toFixed(0)}). Values imported as given.`,
      };
      rowIssues.push(issue);
      warnings.push(issue);
    }

    // Warning: 20% delta vs prior snapshot
    const prior = priorSnapshots.get(row.jobNo.trim());
    if (prior && prior.forecastContract > 0) {
      const delta = Math.abs(row.forecastContract - prior.forecastContract) / prior.forecastContract;
      if (delta > DELTA_THRESHOLD) {
        const issue: ValidationResult = {
          rowIndex: i + 1,
          jobNo: row.jobNo,
          projectName: row.projectName,
          severity: 'warning',
          type: 'CONTRACT_DELTA',
          message: `Forecast Contract changed by ${(delta * 100).toFixed(1)}% vs prior snapshot (${prior.forecastContract.toFixed(0)} → ${row.forecastContract.toFixed(0)}). Flag for review.`,
        };
        rowIssues.push(issue);
        warnings.push(issue);
      }
    }

    const rowStatus: RowValidationStatus =
      rowIssues.some((i) => i.severity === 'error')
        ? 'error'
        : rowIssues.some((i) => i.severity === 'warning')
        ? 'warning'
        : 'ok';

    validatedRows.push({ row, status: rowStatus, issues: rowIssues });
  }

  return {
    validatedRows,
    errors,
    warnings,
    hasBlockingErrors: errors.length > 0,
  };
}
