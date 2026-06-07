import { daysUntil, EXPIRY_WARN_DAYS } from "./compliance";

export type ReadinessStatus = "ready" | "warning" | "not_ready";

export interface WorkerReadinessResult {
  status: ReadinessStatus;
  whiteCardOk: boolean;
  whiteCardExpiring: boolean;
  nokOk: boolean;
  siteInductionOk: boolean;
  buildingMgmtOk: boolean;
  issues: string[];
}

export const ANNUAL_MS = 365 * 24 * 60 * 60 * 1000;

export function currentPassedTemplateIds(
  completions: { templateId: string; signedAt: Date }[],
): string[] {
  const cutoff = new Date(Date.now() - ANNUAL_MS);
  return completions.filter((c) => c.signedAt > cutoff).map((c) => c.templateId);
}

export function checkWorkerReadiness(opts: {
  whiteCardNo: string | null;
  whiteCardExpiry: Date | null;
  nokName: string | null;
  nokPhone: string | null;
  passedTemplateIds: string[];
  siteTemplateId: string | null;
  buildingMgmtRequired: boolean;
  buildingMgmtCompleted: boolean;
}): WorkerReadinessResult {
  const issues: string[] = [];

  let whiteCardOk = !!opts.whiteCardNo;
  let whiteCardExpiring = false;

  if (!opts.whiteCardNo) {
    issues.push("White card number not recorded");
  } else if (opts.whiteCardExpiry) {
    const days = daysUntil(opts.whiteCardExpiry);
    if (days < 0) {
      whiteCardOk = false;
      issues.push("White card expired");
    } else if (days <= EXPIRY_WARN_DAYS) {
      whiteCardExpiring = true;
      issues.push(`White card expiring in ${days}d`);
    }
  }

  const nokOk = !!(opts.nokName?.trim() && opts.nokPhone?.trim());
  if (!nokOk) issues.push("Next-of-kin details incomplete");

  const siteInductionOk =
    !opts.siteTemplateId || opts.passedTemplateIds.includes(opts.siteTemplateId);
  if (!siteInductionOk) issues.push("Site induction not completed");

  const buildingMgmtOk = !opts.buildingMgmtRequired || opts.buildingMgmtCompleted;
  if (!buildingMgmtOk) issues.push("Building mgmt induction not completed");

  const hardBlock = !whiteCardOk || !nokOk || !buildingMgmtOk;
  const softWarn = whiteCardExpiring || !siteInductionOk;

  return {
    status: hardBlock ? "not_ready" : softWarn ? "warning" : "ready",
    whiteCardOk,
    whiteCardExpiring,
    nokOk,
    siteInductionOk,
    buildingMgmtOk,
    issues,
  };
}
