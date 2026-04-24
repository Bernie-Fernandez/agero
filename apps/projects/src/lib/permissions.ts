// Client-safe re-export of role/permission utilities (no DB dependency)
export {
  getRolePreset,
  resolvePermissions,
  canAccess,
  canApprove,
  ROLE_METADATA,
  ALL_ROLES,
} from '../../../../packages/db/src/permissions';

export type {
  PermissionSet,
  ModuleAccess,
  MafAuthority,
} from '../../../../packages/db/src/permissions';
