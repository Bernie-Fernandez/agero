export { prismaErp } from "./client";

export * from "./generated/prisma/client";
export { DEFAULT_COST_PLAN } from "../prisma/cost-plan-defaults";
export type { DefaultLine, DefaultSection } from "../prisma/cost-plan-defaults";
export { getRolePreset, resolvePermissions, canAccess, canApprove, invalidateModuleCache, ROLE_METADATA, ALL_ROLES } from "./permissions";
export type { PermissionSet, ModuleAccess, MafAuthority } from "./permissions";
