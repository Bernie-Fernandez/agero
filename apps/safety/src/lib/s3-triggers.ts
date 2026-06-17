// Auto-trigger mapping (Sprint S3 §3).
// When a pre-start HRW classification is flagged "Yes", the corresponding S3 risk
// assessment / register becomes a required task in the Layer 1 readiness checklist.

export type S3FormKey =
  | "traffic"
  | "plant"
  | "msds"
  | "manual-handling"
  | "test-tag";

export interface S3FormDef {
  key: S3FormKey;
  label: string;
  desc: string;
  /** Pre-start HRW classification ids that trigger this form. */
  triggerFlags: string[];
  /** Route segment under /projects/[safetyProjectId]/ */
  route: string;
}

export const S3_FORMS: S3FormDef[] = [
  {
    key: "traffic",
    label: "Traffic Management Review & Hazard Assessment",
    desc: "AS 1742.3-2009 · review checklist + traffic hazard risk assessment",
    triggerFlags: ["traffic"],
    route: "traffic-management",
  },
  {
    key: "plant",
    label: "Plant Register & Daily Pre-Start",
    desc: "Plant items, service records, Mon–Sun pre-start grid, fault blocking",
    triggerFlags: ["mobile_plant"],
    route: "plant",
  },
  {
    key: "msds",
    label: "Hazardous Substances MSDS Register",
    desc: "Per-substance register, 5-year MSDS currency rule, risk assessment",
    triggerFlags: ["chem_lines", "flammable_atm"],
    route: "msds",
  },
  {
    key: "manual-handling",
    label: "Manual Handling Risk Assessment",
    desc: "Hierarchy of controls enforced · Victorian compliance code aligned",
    // No dedicated pre-start flag exists; always available manually. Listed here so
    // the readiness panel surfaces it. (See sprint note.)
    triggerFlags: [],
    route: "manual-handling",
  },
  {
    key: "test-tag",
    label: "Test & Tag Register",
    desc: "Electrical equipment, 3-month testing cycle with expiry alerts",
    triggerFlags: ["electrical", "crystalline_silica"],
    route: "test-tag",
  },
];

export interface HrwFlag {
  id: string;
  flagged?: boolean;
}

/** Returns the S3 form keys auto-required by the supplied pre-start HRW flags. */
export function requiredS3Forms(highRiskFlags: unknown): Set<S3FormKey> {
  const required = new Set<S3FormKey>();
  if (!Array.isArray(highRiskFlags)) return required;
  const flaggedIds = new Set(
    (highRiskFlags as HrwFlag[]).filter((f) => f?.flagged).map((f) => f.id),
  );
  for (const form of S3_FORMS) {
    if (form.triggerFlags.some((id) => flaggedIds.has(id))) required.add(form.key);
  }
  return required;
}
