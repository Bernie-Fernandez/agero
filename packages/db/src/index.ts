import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  erpPrisma: PrismaClient | undefined;
  erpPool: Pool | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = globalForPrisma.erpPool ?? new Pool({ connectionString });
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.erpPool = pool;
  }
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter, log: ["error"] });
}

export const prismaErp = globalForPrisma.erpPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.erpPrisma = prismaErp;
}

export * from "../generated/prisma/client";
