import { PrismaPg } from "@prisma/adapter-pg";
import { Pool, types } from "pg";
import { PrismaClient } from "./generated/prisma/client";

types.setTypeParser(1082, (val: string) => (val ? new Date(val + "T00:00:00.000Z") : null));

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

  globalForPrisma.erpPrisma = client;

  return client;
}

export const prismaErp = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
