/**
 * Agero ERP — Seed Sprint 12: Trade Sections + Scope Library Templates
 *
 * Inserts 24 org-level trade sections and 18 scope library items for the
 * seed organisation. Safe to re-run — skips rows that already exist.
 *
 * Run from packages/db:
 *   node prisma/seed-sprint12.mjs
 */

import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set in packages/db/.env");
}

const pool = new Pool({ connectionString });

const SEED_ORG_ID = "a1000000-0000-0000-0000-000000000001";

const TRADE_SECTIONS = [
  { code: "01", name: "Preliminaries & General Conditions",  order: 1 },
  { code: "02", name: "Demolition & Strip-Out",              order: 2 },
  { code: "03", name: "Structural & Concrete Works",         order: 3 },
  { code: "04", name: "Masonry & Blockwork",                 order: 4 },
  { code: "05", name: "Steel & Metalwork",                   order: 5 },
  { code: "06", name: "Carpentry & Joinery",                 order: 6 },
  { code: "07", name: "Waterproofing & Tanking",             order: 7 },
  { code: "08", name: "Roofing & Cladding",                  order: 8 },
  { code: "09", name: "Windows, Glazing & Curtain Wall",     order: 9 },
  { code: "10", name: "Doors & Hardware",                    order: 10 },
  { code: "11", name: "Internal Partitions & Framing",       order: 11 },
  { code: "12", name: "Ceilings & Soffits",                  order: 12 },
  { code: "13", name: "Flooring & Floor Finishes",           order: 13 },
  { code: "14", name: "Wall Finishes & Linings",             order: 14 },
  { code: "15", name: "Painting & Decorating",               order: 15 },
  { code: "16", name: "Hydraulics & Plumbing",               order: 16 },
  { code: "17", name: "Mechanical & HVAC",                   order: 17 },
  { code: "18", name: "Electrical & Data",                   order: 18 },
  { code: "19", name: "Fire Protection & Sprinklers",        order: 19 },
  { code: "20", name: "Lifts & Vertical Transport",          order: 20 },
  { code: "21", name: "Furniture, Fixtures & Equipment",     order: 21 },
  { code: "22", name: "Landscaping & External Works",        order: 22 },
  { code: "23", name: "Statutory & Authority Fees",          order: 23 },
  { code: "24", name: "Contingency & Provisional Sums",      order: 24 },
];

// keyed by trade section code
const SCOPE_TEMPLATES = [
  { sectionCode: "02", description: "Full Strip-Out Package",              unit: "item" },
  { sectionCode: "02", description: "Selective Demolition",                unit: "item" },
  { sectionCode: "03", description: "Concrete Slab & Footing",             unit: "m2"   },
  { sectionCode: "06", description: "Millwork & Custom Joinery",           unit: "item" },
  { sectionCode: "11", description: "Metal Stud & Plasterboard",           unit: "m2"   },
  { sectionCode: "12", description: "Suspended Ceiling Grid",              unit: "m2"   },
  { sectionCode: "13", description: "Carpet & Resilient Flooring",         unit: "m2"   },
  { sectionCode: "13", description: "Tile & Stone Flooring",               unit: "m2"   },
  { sectionCode: "14", description: "Plasterboard & Render",               unit: "m2"   },
  { sectionCode: "15", description: "Full Paint Package",                  unit: "m2"   },
  { sectionCode: "16", description: "Hydraulics Package",                  unit: "item" },
  { sectionCode: "17", description: "HVAC Supply & Install",               unit: "item" },
  { sectionCode: "17", description: "BMS & Controls",                      unit: "item" },
  { sectionCode: "18", description: "Electrical Fitout",                   unit: "item" },
  { sectionCode: "18", description: "Data & Communications",               unit: "item" },
  { sectionCode: "18", description: "AV & Security",                       unit: "item" },
  { sectionCode: "19", description: "Sprinkler Extension & Modifications", unit: "item" },
  { sectionCode: "21", description: "FF&E Supply & Install",               unit: "item" },
];

async function run() {
  const client = await pool.connect();
  try {
    let sectionsInserted = 0;
    let sectionsSkipped  = 0;
    let scopeInserted    = 0;
    let scopeSkipped     = 0;

    // ── Trade Sections ────────────────────────────────────────────────────────
    console.log("Seeding trade sections…");
    for (const section of TRADE_SECTIONS) {
      const { rows } = await client.query(
        `SELECT id FROM projects.estimate_trade_sections
         WHERE organisation_id = $1 AND code = $2 AND estimate_id IS NULL
         LIMIT 1`,
        [SEED_ORG_ID, section.code]
      );
      if (rows.length > 0) {
        console.log(`  SKIP  ${section.code} — ${section.name}`);
        sectionsSkipped++;
        continue;
      }
      await client.query(
        `INSERT INTO projects.estimate_trade_sections
           (id, organisation_id, estimate_id, name, code, "order")
         VALUES (gen_random_uuid(), $1, NULL, $2, $3, $4)`,
        [SEED_ORG_ID, section.name, section.code, section.order]
      );
      console.log(`  OK    ${section.code} — ${section.name}`);
      sectionsInserted++;
    }

    // ── Scope Library Templates ───────────────────────────────────────────────
    console.log("\nSeeding scope library templates…");
    for (const tmpl of SCOPE_TEMPLATES) {
      // look up the trade section we just inserted
      const { rows: secRows } = await client.query(
        `SELECT id FROM projects.estimate_trade_sections
         WHERE organisation_id = $1 AND code = $2 AND estimate_id IS NULL
         LIMIT 1`,
        [SEED_ORG_ID, tmpl.sectionCode]
      );
      const sectionId = secRows[0]?.id ?? null;

      const { rows: existing } = await client.query(
        `SELECT id FROM projects.scope_library_items
         WHERE organisation_id = $1 AND description = $2
         LIMIT 1`,
        [SEED_ORG_ID, tmpl.description]
      );
      if (existing.length > 0) {
        console.log(`  SKIP  ${tmpl.description}`);
        scopeSkipped++;
        continue;
      }
      await client.query(
        `INSERT INTO projects.scope_library_items
           (id, organisation_id, trade_section_id, description, unit, is_global, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, TRUE, NOW())`,
        [SEED_ORG_ID, sectionId, tmpl.description, tmpl.unit]
      );
      console.log(`  OK    [${tmpl.sectionCode}] ${tmpl.description}`);
      scopeInserted++;
    }

    console.log(`
────────────────────────────────────
Trade sections : ${sectionsInserted} inserted, ${sectionsSkipped} skipped
Scope templates: ${scopeInserted} inserted, ${scopeSkipped} skipped
────────────────────────────────────`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => { console.error(err); process.exit(1); });
