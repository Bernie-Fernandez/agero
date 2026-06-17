// Sprint S4 — static reference data for the annual review engine, legislation
// register, and ISO 45001 audit evidence package.
//
// This module is import-safe for both the Next.js app and `prisma/seed.ts`
// (no runtime/server-only imports — pure data and types).

// ─────────────────────────────────────────────────────────────────────────────
// ISO 45001 clause map (Sprint S4 §4)
// ─────────────────────────────────────────────────────────────────────────────

export interface IsoClause {
  clause: string;
  requirement: string;
  /** Form template keys that provide evidence for this clause. */
  evidence: string[];
}

export const ISO_CLAUSES: IsoClause[] = [
  {
    clause: "7.2",
    requirement: "Competence",
    evidence: ["worker_credentials"],
  },
  {
    clause: "7.3",
    requirement: "Awareness",
    evidence: ["induction_generic", "induction_site", "toolbox"],
  },
  {
    clause: "8.1.2",
    requirement: "Hazard identification and risk assessment",
    evidence: ["pre_start", "manual_handling", "traffic_management", "task_risk", "msds"],
  },
  {
    clause: "8.1.4.2",
    requirement: "Contractor management",
    evidence: ["swms", "subcontractor_compliance", "subcontractor_performance"],
  },
  {
    clause: "8.2",
    requirement: "Emergency preparedness",
    evidence: ["first_aid", "incident"],
  },
  {
    clause: "9.1",
    requirement: "Monitoring and measurement",
    evidence: ["site_safety_walk", "attendance", "test_tag"],
  },
  {
    clause: "10.2",
    requirement: "Incident and nonconformance",
    evidence: ["incident", "ncr"],
  },
  {
    clause: "10.3",
    requirement: "Continual improvement",
    evidence: ["annual_review", "legislation_register", "management_review"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// WHS document templates (Sprint S4 §5 task 3) — seeded at version 1.
// ─────────────────────────────────────────────────────────────────────────────

export interface WhsTemplateDef {
  templateKey: string;
  name: string;
  isoClauses: string[];
  complianceCodes: string[];
}

export const WHS_TEMPLATES: WhsTemplateDef[] = [
  { templateKey: "pre_start", name: "Pre-Start Risk Assessment", isoClauses: ["8.1.2"], complianceCodes: ["OHS Regulations 2017", "Prevention of Falls in General Construction"] },
  { templateKey: "site_prep", name: "Site Preparation Plan & Checklist", isoClauses: ["8.1.2", "9.1"], complianceCodes: ["Workplace Facilities and the Working Environment"] },
  { templateKey: "manual_handling", name: "Manual Handling Risk Assessment", isoClauses: ["8.1.2"], complianceCodes: ["Hazardous Manual Handling"] },
  { templateKey: "traffic_management", name: "Traffic Management Review & Hazard Assessment", isoClauses: ["8.1.2"], complianceCodes: ["AS 1742.3-2009"] },
  { templateKey: "task_risk", name: "Task Risk Assessment", isoClauses: ["8.1.2"], complianceCodes: ["OHS Regulations 2017"] },
  { templateKey: "msds", name: "Hazardous Substances MSDS Register", isoClauses: ["8.1.2"], complianceCodes: ["Hazardous Substances", "Dangerous Goods Act 1985"] },
  { templateKey: "plant_register", name: "Plant Register & Daily Pre-Start", isoClauses: ["8.1.2", "9.1"], complianceCodes: ["Equipment (Public Safety) Regulations 2007"] },
  { templateKey: "test_tag", name: "Test & Tag Register", isoClauses: ["9.1"], complianceCodes: ["AS/NZS 3760"] },
  { templateKey: "worker_credentials", name: "Worker Credentials Register", isoClauses: ["7.2"], complianceCodes: ["OHS Regulations 2017 Part 3.5 (HRW Licences)"] },
  { templateKey: "induction_generic", name: "Generic Induction", isoClauses: ["7.3"], complianceCodes: ["OHS Act 2004 s21"] },
  { templateKey: "induction_site", name: "Site-Specific Induction", isoClauses: ["7.3"], complianceCodes: ["OHS Act 2004 s21"] },
  { templateKey: "toolbox", name: "Toolbox Meeting Record", isoClauses: ["7.3"], complianceCodes: ["Psychological Health Regulations 2025"] },
  { templateKey: "swms", name: "Safe Work Method Statement (SWMS)", isoClauses: ["8.1.4.2"], complianceCodes: ["OHS Regulations 2017 Part 5.1", "High Risk Construction Work"] },
  { templateKey: "subcontractor_compliance", name: "Subcontractor Compliance Record", isoClauses: ["8.1.4.2"], complianceCodes: ["OHS Act 2004 s26"] },
  { templateKey: "first_aid", name: "First Aid Requirements Checklist", isoClauses: ["8.2"], complianceCodes: ["Compliance Code: First Aid in the Workplace"] },
  { templateKey: "incident", name: "Incident Investigation Report", isoClauses: ["8.2", "10.2"], complianceCodes: ["OHS Act 2004 Part 5 (Incident Notification)"] },
  { templateKey: "ncr", name: "Non-Conformance Report", isoClauses: ["10.2"], complianceCodes: ["ISO 45001:2018 Clause 10.2"] },
  { templateKey: "site_safety_walk", name: "Site Safety Walk", isoClauses: ["9.1"], complianceCodes: ["Psychological Health Regulations 2025"] },
  { templateKey: "annual_review", name: "Annual WHS Documentation Review", isoClauses: ["10.3"], complianceCodes: ["ISO 45001:2018 Clause 9.3, 10.3"] },
];

// ─────────────────────────────────────────────────────────────────────────────
// Legislation register seed (Sprint S4 §3) — current as of June 2026.
// ─────────────────────────────────────────────────────────────────────────────

export type LegislationCategory =
  | "ACT"
  | "REGULATION"
  | "STANDARD"
  | "COMPLIANCE_CODE"
  | "PRACTICE_NOTE";

export interface LegislationSeed {
  title: string;
  reference: string;
  category: LegislationCategory;
  version: string;
  effectiveDate: string; // ISO yyyy-mm-dd
  affectsTemplateKeys: string[];
}

export const LEGISLATION_SEED: LegislationSeed[] = [
  { title: "Victorian Occupational Health and Safety Act 2004", reference: "OHS Act 2004", category: "ACT", version: "2004 (as amended)", effectiveDate: "2005-07-01", affectsTemplateKeys: ["pre_start", "site_prep", "incident", "subcontractor_compliance"] },
  { title: "Victorian Occupational Health and Safety Regulations 2017", reference: "OHS Regulations 2017", category: "REGULATION", version: "2017", effectiveDate: "2017-06-18", affectsTemplateKeys: ["pre_start", "manual_handling", "task_risk", "swms", "worker_credentials", "msds", "plant_register"] },
  { title: "Victorian Occupational Health and Safety (Psychological Health) Regulations 2025", reference: "Psychological Health Regulations 2025", category: "REGULATION", version: "2025", effectiveDate: "2025-12-01", affectsTemplateKeys: ["pre_start", "toolbox", "site_safety_walk"] },
  { title: "Equipment (Public Safety) Act 1994 and Regulations 2007", reference: "Equipment (Public Safety) Act 1994", category: "ACT", version: "2007", effectiveDate: "2007-12-01", affectsTemplateKeys: ["plant_register"] },
  { title: "Dangerous Goods Act 1985", reference: "Dangerous Goods Act 1985", category: "ACT", version: "1985 (as amended)", effectiveDate: "1985-01-01", affectsTemplateKeys: ["msds"] },
  { title: "ISO 45001:2018 — Occupational health and safety management systems", reference: "ISO 45001:2018", category: "STANDARD", version: "2018", effectiveDate: "2018-03-12", affectsTemplateKeys: ["annual_review", "ncr"] },
  { title: "ISO 45003:2021 — Psychological health and safety at work", reference: "ISO 45003:2021", category: "STANDARD", version: "2021", effectiveDate: "2021-06-01", affectsTemplateKeys: ["toolbox", "site_safety_walk"] },
  { title: "Compliance Code — Workplace Facilities and the Working Environment", reference: "WorkSafe VIC Compliance Code", category: "COMPLIANCE_CODE", version: "2021", effectiveDate: "2021-01-01", affectsTemplateKeys: ["site_prep"] },
  { title: "Compliance Code — Hazardous Manual Handling", reference: "WorkSafe VIC Compliance Code", category: "COMPLIANCE_CODE", version: "2019", effectiveDate: "2019-01-01", affectsTemplateKeys: ["manual_handling"] },
  { title: "Compliance Code — Hazardous Substances", reference: "WorkSafe VIC Compliance Code", category: "COMPLIANCE_CODE", version: "2019", effectiveDate: "2019-01-01", affectsTemplateKeys: ["msds"] },
  { title: "Compliance Code — Prevention of Falls in General Construction", reference: "WorkSafe VIC Compliance Code", category: "COMPLIANCE_CODE", version: "2021", effectiveDate: "2021-01-01", affectsTemplateKeys: ["pre_start", "task_risk"] },
  { title: "Compliance Code — Noise", reference: "WorkSafe VIC Compliance Code", category: "COMPLIANCE_CODE", version: "2019", effectiveDate: "2019-01-01", affectsTemplateKeys: ["task_risk"] },
  { title: "Compliance Code — Confined Spaces", reference: "WorkSafe VIC Compliance Code", category: "COMPLIANCE_CODE", version: "2021", effectiveDate: "2021-01-01", affectsTemplateKeys: ["pre_start", "task_risk"] },
  { title: "Compliance Code — Demolition Work", reference: "WorkSafe VIC Compliance Code", category: "COMPLIANCE_CODE", version: "2021", effectiveDate: "2021-01-01", affectsTemplateKeys: ["pre_start", "task_risk"] },
  { title: "Compliance Code — Excavation Work", reference: "WorkSafe VIC Compliance Code", category: "COMPLIANCE_CODE", version: "2021", effectiveDate: "2021-01-01", affectsTemplateKeys: ["pre_start", "task_risk"] },
  { title: "AS 1742.3-2009 — Manual of uniform traffic control devices (construction zones)", reference: "AS 1742.3-2009", category: "STANDARD", version: "2009", effectiveDate: "2009-01-01", affectsTemplateKeys: ["traffic_management"] },
  { title: "Practice Note — High Risk Construction Work", reference: "WorkSafe VIC Practice Note", category: "PRACTICE_NOTE", version: "2018", effectiveDate: "2018-01-01", affectsTemplateKeys: ["swms"] },
  { title: "Practice Note — Crystalline Silica — High Risk Work (2024)", reference: "WorkSafe VIC Practice Note", category: "PRACTICE_NOTE", version: "2024", effectiveDate: "2024-07-01", affectsTemplateKeys: ["task_risk", "test_tag"] },
];
