/**
 * Agero ERP — Sprint 1 Seed
 *
 * Seeds the test project L16/350 Queen Street with its exact ID that the
 * Safety system references. Run AFTER prisma db push.
 *
 * Usage (from packages/db/):
 *   npx prisma db seed
 *
 * Or directly:
 *   npx ts-node --esm prisma/seed.ts
 */

import "dotenv/config";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set in packages/db/.env");
}

const pool = new Pool({ connectionString });

// Fixed IDs — preserve these forever
const SEED_ORGANISATION_ID = "a1000000-0000-0000-0000-000000000001";
const SEED_USER_ID = "b2000000-0000-0000-0000-000000000001";
const TEST_PROJECT_ID = "9b64a2a7-f8fe-4b51-8c44-d5f550e35a3c";

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Upsert default Organisation (Agero Group Pty Ltd)
    await client.query(
      `
      INSERT INTO projects.organisations (id, name, abn, primary_email, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
      `,
      [SEED_ORGANISATION_ID, "Agero Group Pty Ltd", "12345678901", "bfernandez@agero.com.au"]
    );

    // 2. Upsert default admin User (Bernie — update clerk_id after first login)
    await client.query(
      `
      INSERT INTO projects.users (id, clerk_id, organisation_id, first_name, last_name, email, role, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
      `,
      [
        SEED_USER_ID,
        "REPLACE_WITH_CLERK_USER_ID",
        SEED_ORGANISATION_ID,
        "Bernard",
        "Fernandez",
        "bfernandez@agero.com.au",
        "DIRECTOR",
      ]
    );

    // 3. Upsert test project — ID MUST match Safety system reference exactly
    await client.query(
      `
      INSERT INTO projects.projects (
        id, organisation_id, name, project_number, status,
        address_street, address_suburb, address_state, address_postcode,
        created_by_id, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
      `,
      [
        TEST_PROJECT_ID,
        SEED_ORGANISATION_ID,
        "L16/350 Queen Street Fitout",
        "L16-350Q",
        "ACTIVE",
        "350 Queen Street",
        "Melbourne",
        "VIC",
        "3000",
        SEED_USER_ID,
      ]
    );

    await client.query("COMMIT");
    console.log("Seed complete.");
    console.log(`  Organisation: ${SEED_ORGANISATION_ID}`);
    console.log(`  User (Bernie): ${SEED_USER_ID}`);
    console.log(`  Test project: ${TEST_PROJECT_ID} — L16/350 Queen Street Fitout`);
    console.log("");
    console.log("ACTION REQUIRED:");
    console.log("  Update the clerk_id on the seed user after first login.");
    console.log("  Run: UPDATE projects.users SET clerk_id = '<your-clerk-id>' WHERE id = '" + SEED_USER_ID + "';");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
