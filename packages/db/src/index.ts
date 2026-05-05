import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "./generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  erpPrisma: PrismaClient | undefined;
  erpPool: Pool | undefined;
};

function getClient(): PrismaClient {
  if (globalForPrisma.erpPrisma) return globalForPrisma.erpPrisma;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  if (!globalForPrisma.erpPool) {
    globalForPrisma.erpPool = new Pool({ connectionString });
  }
  const adapter = new PrismaPg(globalForPrisma.erpPool);
  const client = new PrismaClient({ adapter, log: ["error"] });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.erpPrisma = client;
  }

  return client;
}

// Lazy proxy — DATABASE_URL is only required when a query is actually made, not at import time.
export const prismaErp = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export * from "./generated/prisma/client";
export { DEFAULT_COST_PLAN } from "../prisma/cost-plan-defaults";
export type { DefaultLine, DefaultSection } from "../prisma/cost-plan-defaults";
export { getRolePreset, resolvePermissions, canAccess, canApprove, ROLE_METADATA, ALL_ROLES } from "./permissions";
export type { PermissionSet, ModuleAccess, MafAuthority } from "./permissions";
