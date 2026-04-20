import type { UserRole } from "@/generated/safety-prisma/client";

// AppNav replaced by unified NavShell — returns null to avoid double headers
export function AppNav({
  currentPath: _currentPath,
  userRole: _userRole,
}: {
  currentPath?: string;
  userRole?: UserRole;
}) {
  return null;
}
