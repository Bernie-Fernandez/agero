import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Fixed UUID for Agero Group Pty Ltd — used as the single tenant org for all Safety data.
// Must never change once seeded.
export const AGERO_ORG_ID = "f0e1d2c3-b4a5-4967-8c0d-1e2f3a4b5c6d";

async function main() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL must be set");

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  // ── 1. Seed Agero Group Organisation ──────────────────────────────────────
  const org = await prisma.organisation.upsert({
    where: { id: AGERO_ORG_ID },
    update: {},
    create: {
      id: AGERO_ORG_ID,
      name: "Agero Group Pty Ltd",
      abn: "63 639 459 285",
      isActive: true,
    },
  });
  console.log(`✓ Organisation seeded: ${org.name} (${org.id})`);

  // ── 2. Backfill Worker.organisation_id for all existing workers ───────────
  const { count } = await prisma.worker.updateMany({
    where: { organisationId: null },
    data: { organisationId: AGERO_ORG_ID },
  });
  console.log(`✓ Backfilled ${count} worker(s) with organisation_id`);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
