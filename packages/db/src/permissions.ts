/**
 * Agero ERP — Permission System
 * Role presets + runtime resolver for the 25-role system defined in Sprint 13.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ModuleAccess = 'none' | 'read' | 'own' | 'full';

export type MafAuthority = {
  state: 'none' | 'prepare' | 'approve';
  limit: number; // 0 = unlimited
};

export interface PermissionSet {
  modules: {
    admin: ModuleAccess;
    finance: ModuleAccess;
    estimating: ModuleAccess;
    crm: ModuleAccess;
    delivery: ModuleAccess;
    safety: ModuleAccess;
    marketing: ModuleAccess;
  };
  maf: {
    subcontract_award: MafAuthority;
    supplier_order: MafAuthority;
    subcontract_variation: MafAuthority;
    subcontract_claim: MafAuthority;
    client_variation: MafAuthority;
    head_contract: MafAuthority;
    tender_submission: MafAuthority;
  };
}

// ─── MAF defaults by tier ─────────────────────────────────────────────────────

const MAF_EXEC: MafAuthority = { state: 'approve', limit: 0 };
const MAF_SENIOR: MafAuthority = { state: 'approve', limit: 1_000_000 };
const MAF_MID: MafAuthority = { state: 'approve', limit: 50_000 };
const MAF_OPS: MafAuthority = { state: 'prepare', limit: 0 };
const MAF_NONE: MafAuthority = { state: 'none', limit: 0 };

function mafExec() { return { subcontract_award: MAF_EXEC, supplier_order: MAF_EXEC, subcontract_variation: MAF_EXEC, subcontract_claim: MAF_EXEC, client_variation: MAF_EXEC, head_contract: MAF_EXEC, tender_submission: MAF_EXEC }; }
function mafSenior() { return { subcontract_award: MAF_SENIOR, supplier_order: MAF_SENIOR, subcontract_variation: MAF_SENIOR, subcontract_claim: MAF_SENIOR, client_variation: MAF_SENIOR, head_contract: MAF_SENIOR, tender_submission: MAF_SENIOR }; }
function mafMid() { return { subcontract_award: MAF_MID, supplier_order: MAF_MID, subcontract_variation: MAF_MID, subcontract_claim: MAF_MID, client_variation: MAF_MID, head_contract: MAF_MID, tender_submission: MAF_MID }; }
function mafOps() { return { subcontract_award: MAF_OPS, supplier_order: MAF_OPS, subcontract_variation: MAF_OPS, subcontract_claim: MAF_OPS, client_variation: MAF_OPS, head_contract: MAF_OPS, tender_submission: MAF_OPS }; }
function mafNone() { return { subcontract_award: MAF_NONE, supplier_order: MAF_NONE, subcontract_variation: MAF_NONE, subcontract_claim: MAF_NONE, client_variation: MAF_NONE, head_contract: MAF_NONE, tender_submission: MAF_NONE }; }

// ─── Role Presets ─────────────────────────────────────────────────────────────

const PRESETS: Record<string, PermissionSet> = {
  DIRECTOR: {
    modules: { admin: 'full', finance: 'full', estimating: 'full', crm: 'full', delivery: 'full', safety: 'full', marketing: 'full' },
    maf: mafExec(),
  },
  GENERAL_MANAGER: {
    modules: { admin: 'full', finance: 'full', estimating: 'full', crm: 'full', delivery: 'full', safety: 'full', marketing: 'full' },
    maf: mafExec(),
  },
  CONSTRUCTION_MANAGER: {
    modules: { admin: 'none', finance: 'full', estimating: 'full', crm: 'full', delivery: 'full', safety: 'full', marketing: 'full' },
    maf: mafSenior(),
  },
  PROJECT_DIRECTOR: {
    modules: { admin: 'none', finance: 'full', estimating: 'full', crm: 'full', delivery: 'full', safety: 'full', marketing: 'full' },
    maf: mafSenior(),
  },
  FINANCIAL_CONTROLLER: {
    modules: { admin: 'none', finance: 'full', estimating: 'read', crm: 'read', delivery: 'read', safety: 'read', marketing: 'read' },
    maf: mafSenior(),
  },
  SENIOR_CONSULTANT_PRECON: {
    modules: { admin: 'none', finance: 'read', estimating: 'full', crm: 'read', delivery: 'full', safety: 'full', marketing: 'full' },
    maf: mafSenior(),
  },
  SENIOR_ESTIMATOR: {
    modules: { admin: 'none', finance: 'read', estimating: 'full', crm: 'full', delivery: 'read', safety: 'full', marketing: 'full' },
    maf: mafSenior(),
  },
  SENIOR_CONTRACTS_ADMIN: {
    modules: { admin: 'none', finance: 'read', estimating: 'read', crm: 'full', delivery: 'full', safety: 'full', marketing: 'full' },
    maf: mafSenior(),
  },
  PROJECT_MANAGER_DELIVERY: {
    modules: { admin: 'none', finance: 'read', estimating: 'own', crm: 'read', delivery: 'full', safety: 'own', marketing: 'none' },
    maf: mafMid(),
  },
  PROJECT_MANAGER_FRONTEND: {
    modules: { admin: 'none', finance: 'read', estimating: 'own', crm: 'read', delivery: 'full', safety: 'own', marketing: 'full' },
    maf: mafMid(),
  },
  SITE_MANAGER: {
    modules: { admin: 'none', finance: 'none', estimating: 'none', crm: 'read', delivery: 'own', safety: 'full', marketing: 'none' },
    maf: mafMid(),
  },
  CONSULTANT_PRECON: {
    modules: { admin: 'none', finance: 'read', estimating: 'own', crm: 'read', delivery: 'read', safety: 'own', marketing: 'full' },
    maf: mafMid(),
  },
  ESTIMATOR: {
    modules: { admin: 'none', finance: 'read', estimating: 'full', crm: 'full', delivery: 'read', safety: 'own', marketing: 'full' },
    maf: mafMid(),
  },
  CONTRACTS_ADMIN: {
    modules: { admin: 'none', finance: 'read', estimating: 'read', crm: 'full', delivery: 'own', safety: 'own', marketing: 'none' },
    maf: mafMid(),
  },
  BUSINESS_DEVELOPER: {
    modules: { admin: 'none', finance: 'none', estimating: 'read', crm: 'full', delivery: 'none', safety: 'own', marketing: 'full' },
    maf: mafMid(),
  },
  BOOKKEEPER: {
    modules: { admin: 'none', finance: 'full', estimating: 'read', crm: 'read', delivery: 'read', safety: 'none', marketing: 'none' },
    maf: mafMid(),
  },
  HUMAN_RESOURCES: {
    modules: { admin: 'none', finance: 'none', estimating: 'none', crm: 'read', delivery: 'read', safety: 'own', marketing: 'none' },
    maf: mafNone(),
  },
  JUNIOR_PM: {
    modules: { admin: 'none', finance: 'none', estimating: 'own', crm: 'read', delivery: 'own', safety: 'own', marketing: 'none' },
    maf: mafOps(),
  },
  SITE_SUPERVISOR: {
    modules: { admin: 'none', finance: 'none', estimating: 'none', crm: 'none', delivery: 'own', safety: 'full', marketing: 'none' },
    maf: mafOps(),
  },
  PRECON_ASSOCIATE: {
    modules: { admin: 'none', finance: 'read', estimating: 'own', crm: 'read', delivery: 'read', safety: 'own', marketing: 'none' },
    maf: mafOps(),
  },
  BID_MANAGER: {
    modules: { admin: 'none', finance: 'none', estimating: 'read', crm: 'full', delivery: 'none', safety: 'own', marketing: 'full' },
    maf: mafOps(),
  },
  PROJECT_COORDINATOR: {
    modules: { admin: 'none', finance: 'none', estimating: 'none', crm: 'read', delivery: 'own', safety: 'own', marketing: 'none' },
    maf: mafNone(),
  },
  PROJECT_ADMIN: {
    modules: { admin: 'none', finance: 'none', estimating: 'none', crm: 'read', delivery: 'own', safety: 'own', marketing: 'none' },
    maf: mafNone(),
  },
  ASST_SITE_SUPERVISOR: {
    modules: { admin: 'none', finance: 'none', estimating: 'none', crm: 'none', delivery: 'own', safety: 'own', marketing: 'none' },
    maf: mafNone(),
  },
  SALES_EXEC_ADMIN: {
    modules: { admin: 'none', finance: 'none', estimating: 'none', crm: 'read', delivery: 'read', safety: 'own', marketing: 'read' },
    maf: mafNone(),
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function getRolePreset(role: string): PermissionSet {
  return PRESETS[role] ?? PRESETS['PROJECT_COORDINATOR'];
}

type UserLike = { role: string; permissions?: unknown };

export function resolvePermissions(user: UserLike): PermissionSet {
  const preset = getRolePreset(user.role);
  if (!user.permissions || typeof user.permissions !== 'object') return preset;

  const overrides = user.permissions as Partial<PermissionSet>;
  return {
    modules: { ...preset.modules, ...(overrides.modules ?? {}) },
    maf: { ...preset.maf, ...(overrides.maf ?? {}) },
  };
}

const ACCESS_RANK: Record<ModuleAccess, number> = { none: 0, read: 1, own: 2, full: 3 };

export function canAccess(user: UserLike, module: keyof PermissionSet['modules'], level: ModuleAccess): boolean {
  const perms = resolvePermissions(user);
  const userLevel = perms.modules[module] ?? 'none';
  return ACCESS_RANK[userLevel] >= ACCESS_RANK[level];
}

export function canApprove(user: UserLike, category: keyof PermissionSet['maf'], amount: number): boolean {
  const perms = resolvePermissions(user);
  const maf = perms.maf[category];
  if (!maf || maf.state !== 'approve') return false;
  if (maf.limit === 0) return true; // unlimited
  return amount <= maf.limit;
}

// ─── Role metadata ────────────────────────────────────────────────────────────

export const ROLE_METADATA: Record<string, { label: string; tier: string; stream: string }> = {
  DIRECTOR:                { label: 'Director',                              tier: 'Executive',    stream: 'Leadership' },
  GENERAL_MANAGER:         { label: 'General Manager',                       tier: 'Executive',    stream: 'Leadership' },
  CONSTRUCTION_MANAGER:    { label: 'Construction Manager',                  tier: 'Senior',       stream: 'Leadership' },
  PROJECT_DIRECTOR:        { label: 'Project Director',                      tier: 'Senior',       stream: 'Delivery' },
  FINANCIAL_CONTROLLER:    { label: 'Financial Controller',                  tier: 'Senior',       stream: 'Finance & Admin' },
  SENIOR_CONSULTANT_PRECON:{ label: 'Senior Consultant — Pre-construction',  tier: 'Senior',       stream: 'Pre-construction' },
  SENIOR_ESTIMATOR:        { label: 'Senior Estimator',                      tier: 'Senior',       stream: 'Estimating' },
  SENIOR_CONTRACTS_ADMIN:  { label: 'Senior Contracts Administrator',        tier: 'Senior',       stream: 'Commercial' },
  PROJECT_MANAGER_DELIVERY:{ label: 'Project Manager (delivery)',            tier: 'Mid',          stream: 'Delivery' },
  PROJECT_MANAGER_FRONTEND:{ label: 'Project Manager (front end)',           tier: 'Mid',          stream: 'Delivery' },
  SITE_MANAGER:            { label: 'Site Manager',                          tier: 'Mid',          stream: 'Site' },
  CONSULTANT_PRECON:       { label: 'Consultant — Pre-construction',         tier: 'Mid',          stream: 'Pre-construction' },
  ESTIMATOR:               { label: 'Estimator',                             tier: 'Mid',          stream: 'Estimating' },
  CONTRACTS_ADMIN:         { label: 'Contracts Administrator',               tier: 'Mid',          stream: 'Commercial' },
  BUSINESS_DEVELOPER:      { label: 'Business Developer / Client Relations', tier: 'Mid',          stream: 'Sales & Marketing' },
  BOOKKEEPER:              { label: 'Bookkeeper',                            tier: 'Mid',          stream: 'Finance & Admin' },
  HUMAN_RESOURCES:         { label: 'Human Resources',                       tier: 'Mid',          stream: 'Finance & Admin' },
  JUNIOR_PM:               { label: 'Junior Project Manager',                tier: 'Operational',  stream: 'Delivery' },
  SITE_SUPERVISOR:         { label: 'Site Supervisor',                       tier: 'Operational',  stream: 'Site' },
  PRECON_ASSOCIATE:        { label: 'Pre-construction Associate',            tier: 'Operational',  stream: 'Pre-construction' },
  BID_MANAGER:             { label: 'Bid Manager / Project Support',         tier: 'Operational',  stream: 'Sales & Marketing' },
  PROJECT_COORDINATOR:     { label: 'Project Coordinator',                   tier: 'Support',      stream: 'Delivery' },
  PROJECT_ADMIN:           { label: 'Project Administrator',                 tier: 'Support',      stream: 'Delivery' },
  ASST_SITE_SUPERVISOR:    { label: 'Assistant Site Supervisor',             tier: 'Support',      stream: 'Site' },
  SALES_EXEC_ADMIN:        { label: 'Sales & Executive Administration',      tier: 'Support',      stream: 'Sales & Marketing' },
};

export const ALL_ROLES = Object.keys(PRESETS) as (keyof typeof PRESETS)[];
