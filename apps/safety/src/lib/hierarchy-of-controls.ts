// Victorian OHS hierarchy of controls — enforced across all S3 risk assessments.
// PPE cannot be selected as the *only* control measure (OHS Regulations 2017 reg 36).

export type ControlLevel =
  | "ELIMINATE"
  | "SUBSTITUTE"
  | "ISOLATE"
  | "ENGINEERING"
  | "ADMINISTRATIVE"
  | "PPE";

export interface ControlMeasure {
  level: ControlLevel;
  description: string;
}

export const CONTROL_LEVELS: { level: ControlLevel; rank: number; label: string; hint: string }[] = [
  { level: "ELIMINATE", rank: 1, label: "1. Eliminate the hazard", hint: "Remove the hazard entirely" },
  { level: "SUBSTITUTE", rank: 2, label: "2. Substitute", hint: "Replace with something less hazardous" },
  { level: "ISOLATE", rank: 3, label: "3. Isolate", hint: "Separate the hazard from people" },
  { level: "ENGINEERING", rank: 4, label: "4. Engineering controls", hint: "Physical/mechanical controls" },
  { level: "ADMINISTRATIVE", rank: 5, label: "5. Administrative controls", hint: "Procedures, training, signage" },
  { level: "PPE", rank: 6, label: "6. PPE — last resort", hint: "Cannot be the sole control" },
];

export const PPE_ONLY_WARNING =
  "You must consider higher-level controls before relying on PPE. Confirm all higher controls have been considered and are not reasonably practicable, with a written justification required.";

export function controlLevelLabel(level: ControlLevel): string {
  return CONTROL_LEVELS.find((c) => c.level === level)?.label ?? level;
}

/** True when every recorded control is PPE (or the only control recorded is PPE). */
export function isPpeOnly(controls: { level: ControlLevel; description: string }[]): boolean {
  const valid = controls.filter((c) => c.description.trim().length > 0);
  if (valid.length === 0) return false;
  return valid.every((c) => c.level === "PPE");
}

export interface HierarchyValidation {
  ok: boolean;
  ppeOnly: boolean;
  error?: string;
}

/**
 * Enforces the hierarchy of controls. A PPE-only assessment is permitted only when
 * a written justification has been provided (higher controls considered and not
 * reasonably practicable). Returns ok=false with an error otherwise.
 */
export function validateHierarchy(
  controls: { level: ControlLevel; description: string }[],
  justification: string | null | undefined,
): HierarchyValidation {
  const valid = controls.filter((c) => c.description.trim().length > 0);
  if (valid.length === 0) {
    return { ok: false, ppeOnly: false, error: "At least one control measure is required." };
  }
  const ppeOnly = valid.every((c) => c.level === "PPE");
  if (ppeOnly && !(justification && justification.trim().length > 0)) {
    return { ok: false, ppeOnly: true, error: PPE_ONLY_WARNING };
  }
  return { ok: true, ppeOnly };
}
