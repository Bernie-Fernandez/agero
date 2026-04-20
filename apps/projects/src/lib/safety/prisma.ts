import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../../generated/safety-prisma/client";

const globalForPrisma = globalThis as unknown as {
  safetyPrisma: PrismaClient | undefined;
  safetyPool: Pool | undefined;
};

function createSafetyPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = globalForPrisma.safetyPool ?? new Pool({ connectionString });
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.safetyPool = pool;
  }
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter, log: ["error"] });
}

export const prisma = globalForPrisma.safetyPrisma ?? createSafetyPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.safetyPrisma = prisma;
