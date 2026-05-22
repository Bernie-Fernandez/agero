// Date cascade logic for Lead dates.
// Forward-only: updating a date only recalculates dates AFTER it in the sequence.
// Sequence: goNoGoDate → decisionDate → contractDate → startDate → completionDate
// leaseExpiryDate is independent — never auto-calculated.

export type LeadDates = {
  goNoGoDate?: Date | null;
  decisionDate?: Date | null;
  contractDate?: Date | null;
  startDate?: Date | null;
  completionDate?: Date | null;
  leaseExpiryDate?: Date | null;
  durationMonths?: number | null;
};

export type CascadeConfig = {
  contractToStartOffsetDays: number; // default 14
};

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/**
 * Given the updated field name and the full current lead dates, return the
 * complete set of dates after applying forward cascade. Fields earlier in
 * the sequence than the changed field are returned unchanged.
 *
 * Only fields downstream of `changedField` may change.
 */
export function applyCascade(
  current: LeadDates,
  changedField: keyof LeadDates,
  updatedValue: Date | null | undefined,
  config: CascadeConfig
): LeadDates {
  const result: LeadDates = { ...current, [changedField]: updatedValue };

  // Sequence index — only recalculate fields with higher index
  const SEQUENCE: Array<keyof LeadDates> = [
    'goNoGoDate',
    'decisionDate',
    'contractDate',
    'startDate',
    'completionDate',
  ];

  const changedIdx = SEQUENCE.indexOf(changedField);
  if (changedIdx === -1) {
    // Not a sequenced date (e.g. leaseExpiryDate or durationMonths) — no cascade
    return result;
  }

  // contractDate → startDate: +contractToStartOffsetDays
  if (changedIdx <= SEQUENCE.indexOf('contractDate')) {
    if (result.contractDate) {
      result.startDate = addDays(result.contractDate, config.contractToStartOffsetDays);
    }
  }

  // startDate → completionDate: +durationMonths
  if (changedIdx <= SEQUENCE.indexOf('startDate')) {
    if (result.startDate && result.durationMonths) {
      result.completionDate = addMonths(result.startDate, result.durationMonths);
    }
  }

  return result;
}

/**
 * Returns which fields would change if cascade were applied — for preview UI.
 */
export function previewCascade(
  current: LeadDates,
  changedField: keyof LeadDates,
  updatedValue: Date | null | undefined,
  config: CascadeConfig
): Array<{ field: string; from: Date | null | undefined; to: Date | null | undefined }> {
  const after = applyCascade(current, changedField, updatedValue, config);
  const changes: Array<{ field: string; from: Date | null | undefined; to: Date | null | undefined }> = [];

  const SEQUENCE: Array<keyof LeadDates> = [
    'goNoGoDate', 'decisionDate', 'contractDate', 'startDate', 'completionDate',
  ];
  const changedIdx = SEQUENCE.indexOf(changedField as keyof LeadDates);

  for (const field of SEQUENCE) {
    const idx = SEQUENCE.indexOf(field);
    if (idx <= changedIdx) continue; // don't report the changed field itself or upstream
    const before = current[field] as Date | null | undefined;
    const after_ = after[field] as Date | null | undefined;
    if (String(before) !== String(after_)) {
      changes.push({ field, from: before, to: after_ });
    }
  }

  return changes;
}
