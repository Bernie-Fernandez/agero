import { prisma } from './prisma';

interface AuditLogInput {
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  projectId?: string;
  detail?: Record<string, unknown>;
}

export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        projectId: input.projectId,
        detail: input.detail as never,
      },
    });
  } catch {
    // Audit log failure must never break the main operation
    console.error('[audit] Failed to write audit log:', input);
  }
}
