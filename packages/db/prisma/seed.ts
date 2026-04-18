/**
 * Agero ERP — Seed (Sprint 1 + Sprint 2)
 *
 * Sprint 1: Organisation, seed User (Bernie), test project
 * Sprint 2: Cost codes, insurance policy types, payment terms, alert thresholds
 *
 * Run AFTER prisma db push:
 *   npx prisma db seed
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

// ─── Cost Codes from R2SA-216_CostCodesAlllExcel.xls ───────────────────────
const COST_CODES = [
  // Revenue
  { groupCode: "1000", groupName: "Client",               catCode: "1000", description: "Project Income",              glCode: "2001",  codeType: "REVENUE",       notes: "All Project Related Income" },
  { groupCode: "1000", groupName: "Client",               catCode: "1100", description: "Other Income",                glCode: "2004",  codeType: "REVENUE",       notes: "Not Project Related" },
  // Time Codes
  { groupCode: "2000", groupName: "Time",                 catCode: "2110", description: "Annual Leave",                glCode: null,    codeType: "TIME_CODE",     notes: "Annual Leave - No GL Code Required" },
  { groupCode: "2000", groupName: "Time",                 catCode: "2120", description: "Statutory Leave",             glCode: null,    codeType: "TIME_CODE",     notes: "Public Holidays - No GL Code Required" },
  { groupCode: "2000", groupName: "Time",                 catCode: "2130", description: "Sick Leave",                  glCode: null,    codeType: "TIME_CODE",     notes: "Sick Leave - No GL Code Required" },
  { groupCode: "2000", groupName: "Time",                 catCode: "2140", description: "Study Leave",                 glCode: null,    codeType: "TIME_CODE",     notes: "Study Leave - No GL Code Required" },
  { groupCode: "2000", groupName: "Time",                 catCode: "2150", description: "Special Leave",               glCode: null,    codeType: "TIME_CODE",     notes: "Special Leave - No GL Code Required" },
  { groupCode: "2000", groupName: "Time",                 catCode: "2310", description: "Proj - Scope, Bidding",       glCode: null,    codeType: "TIME_CODE",     notes: "Tendering Related - No GL Code Required" },
  { groupCode: "2000", groupName: "Time",                 catCode: "2320", description: "BD - Prospect New Client",    glCode: null,    codeType: "TIME_CODE",     notes: "Marketing Related - No GL Code Required" },
  { groupCode: "2000", groupName: "Time",                 catCode: "2321", description: "BD - Strat. Part/Network",    glCode: null,    codeType: "TIME_CODE",     notes: "Strategic Partner / Networking" },
  { groupCode: "2000", groupName: "Time",                 catCode: "2322", description: "BD - Scope, Des, Estimate",   glCode: null,    codeType: "TIME_CODE",     notes: "New client quoting or design" },
  { groupCode: "2000", groupName: "Time",                 catCode: "2325", description: "Acc Mgmt - Scope, Des, Es",   glCode: null,    codeType: "TIME_CODE",     notes: "Existing customers" },
  { groupCode: "2000", groupName: "Time",                 catCode: "2326", description: "Marketing - Mgmt, Content",   glCode: null,    codeType: "TIME_CODE",     notes: "Marketing - Mgmt, Content" },
  { groupCode: "2000", groupName: "Time",                 catCode: "2410", description: "Director - Strat, Growth",    glCode: null,    codeType: "TIME_CODE",     notes: "Administration Related - No GL Code Required" },
  { groupCode: "2000", groupName: "Time",                 catCode: "2418", description: "Admin - HR",                  glCode: null,    codeType: "TIME_CODE",     notes: "HR" },
  { groupCode: "2000", groupName: "Time",                 catCode: "2420", description: "Admin - Accounts, Legal",     glCode: null,    codeType: "TIME_CODE",     notes: "Accounts related activity - No GL required" },
  // Job Costs
  { groupCode: "3100", groupName: "Site Prep",            catCode: "3110", description: "Demolition",                  glCode: "462",   codeType: "JOB_COST",      notes: "Subcontract, Plant, Materials & Labour" },
  { groupCode: "3800", groupName: "Construction",         catCode: "3805", description: "Carpentry/Partitions",         glCode: "462",   codeType: "JOB_COST",      notes: "Subcontract, Plant, Materials & Labour" },
  { groupCode: "3800", groupName: "Construction",         catCode: "3830", description: "Construction General",         glCode: "462",   codeType: "JOB_COST",      notes: "Generic Construction - Subcontract, Plant, Materials & Labour" },
  { groupCode: "3849", groupName: "Painting",             catCode: "3850", description: "Paint Finish",                 glCode: "462",   codeType: "JOB_COST",      notes: "Subcontract, Plant, Materials & Labour" },
  { groupCode: "3900", groupName: "Floor Finishes",       catCode: "3905", description: "Carpet & Vinyl",              glCode: "462",   codeType: "JOB_COST",      notes: "Subcontract, Plant, Materials & Labour" },
  { groupCode: "3900", groupName: "Floor Finishes",       catCode: "3910", description: "Concrete Floor Finishes",     glCode: "462",   codeType: "JOB_COST",      notes: "Subcontract, Plant, Materials & Labour" },
  { groupCode: "3900", groupName: "Floor Finishes",       catCode: "3940", description: "Tiling",                      glCode: "462",   codeType: "JOB_COST",      notes: "Subcontract, Plant, Materials & Labour" },
  { groupCode: "4100", groupName: "Services",             catCode: "4105", description: "Electrical Contractor",        glCode: "462",   codeType: "JOB_COST",      notes: "Subcontract, Plant, Materials & Labour" },
  { groupCode: "4100", groupName: "Services",             catCode: "4110", description: "Plumbing Contractor",          glCode: "462",   codeType: "JOB_COST",      notes: "Subcontract, Plant, Materials & Labour" },
  { groupCode: "4100", groupName: "Services",             catCode: "4115", description: "Mechanical Contractor",        glCode: "462",   codeType: "JOB_COST",      notes: "Subcontract, Plant, Materials & Labour" },
  { groupCode: "4100", groupName: "Services",             catCode: "4125", description: "Fire Contractor",              glCode: "462",   codeType: "JOB_COST",      notes: "Subcontract, Plant, Materials & Labour" },
  { groupCode: "4100", groupName: "Services",             catCode: "4135", description: "Security",                     glCode: "462",   codeType: "JOB_COST",      notes: "Subcontract, Plant, Materials & Labour" },
  { groupCode: "4200", groupName: "Joinery",              catCode: "4205", description: "Joinery",                      glCode: "462",   codeType: "JOB_COST",      notes: "Subcontract, Plant, Materials & Labour" },
  { groupCode: "4300", groupName: "Furniture",            catCode: "4305", description: "Furniture",                    glCode: "462",   codeType: "JOB_COST",      notes: "Subcontract, Plant, Materials & Labour" },
  { groupCode: "4400", groupName: "FFE",                  catCode: "4415", description: "FFE Fit. Fix. Equip",          glCode: "462",   codeType: "JOB_COST",      notes: "Subcontract, Plant, Materials & Labour" },
  { groupCode: "4500", groupName: "Finishing",            catCode: "4505", description: "Signage",                      glCode: "462",   codeType: "JOB_COST",      notes: "Subcontract, Plant, Materials & Labour" },
  { groupCode: "4500", groupName: "Finishing",            catCode: "4510", description: "Blinds",                       glCode: "462",   codeType: "JOB_COST",      notes: "Subcontract, Plant, Materials & Labour" },
  { groupCode: "4600", groupName: "Cleaning",             catCode: "4605", description: "Cleaning",                     glCode: "462",   codeType: "JOB_COST",      notes: "Subcontract, Plant, Materials & Labour" },
  { groupCode: "9000", groupName: "Contract Margin",      catCode: "9000", description: "Contract Margin",              glCode: null,    codeType: "JOB_COST",      notes: "No GL Code Required, for job costing only" },
  { groupCode: "9600", groupName: "Internal Plant",       catCode: "9600", description: "Internal Plant Charges",       glCode: "9600",  codeType: "JOB_COST",      notes: "System - All internal plant charges, no GL required" },
  // Retention
  { groupCode: "9100", groupName: "Retention Code",       catCode: "9100", description: "Retentions Held On Us",        glCode: "9100",  codeType: "RETENTION",     notes: "System - Calc for Client Claims (held)" },
  { groupCode: "9100", groupName: "Retention Code",       catCode: "9200", description: "Retentions Released to Us",    glCode: "9200",  codeType: "RETENTION",     notes: "System - Calc for Client Claims (paid)" },
  { groupCode: "9100", groupName: "Retention Code",       catCode: "9300", description: "Retentions Held on Subs",      glCode: "9300",  codeType: "RETENTION",     notes: "System - Calc for Subcontractor Claims (held)" },
  { groupCode: "9100", groupName: "Retention Code",       catCode: "9400", description: "Retentions Paid to Subs",      glCode: "9400",  codeType: "RETENTION",     notes: "System - Calc for Subcontractor Claims (paid)" },
  // Preliminaries — Project Team
  { groupCode: "4900", groupName: "Project Team",         catCode: "4925", description: "Structural Engineer",          glCode: "4623",  codeType: "PRELIMINARIES", notes: "Consultant" },
  { groupCode: "4900", groupName: "Project Team",         catCode: "4945", description: "Services Engineering",         glCode: "4623",  codeType: "PRELIMINARIES", notes: "Consultant" },
  { groupCode: "4900", groupName: "Project Team",         catCode: "4950", description: "Other Engineering",            glCode: "4623",  codeType: "PRELIMINARIES", notes: "Consultant" },
  { groupCode: "4900", groupName: "Project Team",         catCode: "4970", description: "Inter. Des. / Architect",      glCode: "4622",  codeType: "PRELIMINARIES", notes: "Consultant" },
  { groupCode: "4900", groupName: "Project Team",         catCode: "4990", description: "Building Surveyor",            glCode: "4626",  codeType: "PRELIMINARIES", notes: "Consultant" },
  { groupCode: "4900", groupName: "Project Team",         catCode: "4997", description: "Main Contractor",              glCode: "462",   codeType: "PRELIMINARIES", notes: "Main Contractor" },
  // Preliminaries — PG
  { groupCode: "5200", groupName: "PG Preliminaries",     catCode: "5210", description: "DEL Preliminaries",            glCode: "4629",  codeType: "PRELIMINARIES", notes: "Prelims" },
  { groupCode: "5200", groupName: "PG Preliminaries",     catCode: "5211", description: "PREC Preliminaries",           glCode: "4629",  codeType: "PRELIMINARIES", notes: "Precon Prelims" },
  { groupCode: "5400", groupName: "PG Our Project Staff", catCode: "5410", description: "PREC Project Manage.",         glCode: "377",   codeType: "PRELIMINARIES", notes: "Precon. Proj. Management" },
  { groupCode: "5400", groupName: "PG Our Project Staff", catCode: "5440", description: "DEL Project Management",       glCode: "377",   codeType: "PRELIMINARIES", notes: "Agero Attendance" },
  { groupCode: "5400", groupName: "PG Our Project Staff", catCode: "5450", description: "DEL Site Management",          glCode: "377",   codeType: "PRELIMINARIES", notes: "Agero Attendance" },
  { groupCode: "5400", groupName: "PG Our Project Staff", catCode: "5460", description: "PRECON Project Management",    glCode: "377",   codeType: "PRELIMINARIES", notes: "Agero Attendance" },
  { groupCode: "5400", groupName: "PG Our Project Staff", catCode: "5470", description: "DEL Labourer",                 glCode: "377",   codeType: "PRELIMINARIES", notes: "Agero Attendance" },
  { groupCode: "5500", groupName: "PG Overhead",          catCode: "5516", description: "DEL Overhead",                 glCode: "4629",  codeType: "PRELIMINARIES", notes: "Delivery stage alloc. overhead" },
  { groupCode: "5500", groupName: "PG Overhead",          catCode: "5517", description: "PREC. Overhead",               glCode: "4629",  codeType: "PRELIMINARIES", notes: "PREC stage alloc. overheads" },
  // Overhead
  { groupCode: "7000", groupName: "General Overhead",     catCode: "5515", description: "Overhead Job Only",            glCode: "4629",  codeType: "OVERHEAD",      notes: "Overhead costs" },
];

// ─── Insurance Policy Types ─────────────────────────────────────────────────
const INSURANCE_POLICY_TYPES = [
  { name: "Public Liability",       description: "Covers third-party bodily injury and property damage claims", isMandatory: true,  displayOrder: 1 },
  { name: "Workers Compensation",   description: "Covers work-related injuries and illnesses to employees",    isMandatory: true,  displayOrder: 2 },
  { name: "Contract Works",         description: "Covers the works during construction against damage or loss", isMandatory: false, displayOrder: 3 },
  { name: "Professional Indemnity", description: "Covers claims arising from professional advice or services",  isMandatory: false, displayOrder: 4 },
  { name: "Contractors All Risk",   description: "Broad coverage for contractor activities and equipment",      isMandatory: false, displayOrder: 5 },
];

// ─── Payment Terms ───────────────────────────────────────────────────────────
const PAYMENT_TERMS = [
  { name: "7 Days",       description: "Payment due within 7 days of invoice",          isDefault: false, displayOrder: 1 },
  { name: "14 Days",      description: "Payment due within 14 days of invoice",         isDefault: false, displayOrder: 2 },
  { name: "30 Days",      description: "Payment due within 30 days of invoice",         isDefault: true,  displayOrder: 3 },
  { name: "45 Days",      description: "Payment due within 45 days of invoice",         isDefault: false, displayOrder: 4 },
  { name: "End of Month", description: "Payment due at end of the invoice month",       isDefault: false, displayOrder: 5 },
  { name: "7 Days EOM",   description: "Payment due 7 days after end of invoice month", isDefault: false, displayOrder: 6 },
];

// ─── Alert Thresholds ────────────────────────────────────────────────────────
const ALERT_THRESHOLDS = [
  { alertType: "INSURANCE_EXPIRY", daysBefore: 90 },
  { alertType: "INSURANCE_EXPIRY", daysBefore: 60 },
  { alertType: "INSURANCE_EXPIRY", daysBefore: 30 },
  { alertType: "DOCUMENT_EXPIRY",  daysBefore: 90 },
  { alertType: "DOCUMENT_EXPIRY",  daysBefore: 60 },
  { alertType: "DOCUMENT_EXPIRY",  daysBefore: 30 },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── Sprint 1 ──────────────────────────────────────────────────────────────

    // 1. Upsert default Organisation
    await client.query(
      `INSERT INTO projects.organisations (id, name, abn, primary_email, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [SEED_ORGANISATION_ID, "Agero Group Pty Ltd", "12345678901", "bfernandez@agero.com.au"]
    );

    // 2. Upsert admin User (Bernie — update clerk_id after first login)
    await client.query(
      `INSERT INTO projects.users (id, clerk_id, organisation_id, first_name, last_name, email, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [SEED_USER_ID, "REPLACE_WITH_CLERK_USER_ID", SEED_ORGANISATION_ID,
       "Bernard", "Fernandez", "bfernandez@agero.com.au", "DIRECTOR"]
    );

    // 3. Upsert test project (ID must match Safety system)
    await client.query(
      `INSERT INTO projects.projects (
         id, organisation_id, name, project_number, status,
         address_street, address_suburb, address_state, address_postcode,
         created_by_id, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [TEST_PROJECT_ID, SEED_ORGANISATION_ID, "L16/350 Queen Street Fitout", "L16-350Q", "ACTIVE",
       "350 Queen Street", "Melbourne", "VIC", "3000", SEED_USER_ID]
    );

    // ── Sprint 2 ──────────────────────────────────────────────────────────────

    // 4. Cost Codes
    let costCodeCount = 0;
    for (let i = 0; i < COST_CODES.length; i++) {
      const cc = COST_CODES[i];
      const isTradeCategory = cc.codeType === "JOB_COST";
      const result = await client.query(
        `INSERT INTO projects.cost_codes
           (id, organisation_id, group_code, group_name, cat_code, code_description,
            gl_code, code_type, is_trade_category, is_active, display_order, notes, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10, NOW(), NOW())
         ON CONFLICT (cat_code) DO NOTHING`,
        [SEED_ORGANISATION_ID, cc.groupCode, cc.groupName, cc.catCode, cc.description,
         cc.glCode, cc.codeType, isTradeCategory, i + 1, cc.notes]
      );
      if (result.rowCount && result.rowCount > 0) costCodeCount++;
    }

    // 5. Insurance Policy Types
    let insTypeCount = 0;
    for (const t of INSURANCE_POLICY_TYPES) {
      const result = await client.query(
        `INSERT INTO projects.insurance_policy_types
           (id, organisation_id, name, description, is_mandatory, is_active, display_order, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true, $5, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [SEED_ORGANISATION_ID, t.name, t.description, t.isMandatory, t.displayOrder]
      );
      if (result.rowCount && result.rowCount > 0) insTypeCount++;
    }

    // 6. Payment Terms
    let ptCount = 0;
    for (const pt of PAYMENT_TERMS) {
      const result = await client.query(
        `INSERT INTO projects.payment_terms
           (id, organisation_id, name, description, is_default, is_active, display_order, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true, $5, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [SEED_ORGANISATION_ID, pt.name, pt.description, pt.isDefault, pt.displayOrder]
      );
      if (result.rowCount && result.rowCount > 0) ptCount++;
    }

    // 7. Alert Thresholds
    let thresholdCount = 0;
    for (const t of ALERT_THRESHOLDS) {
      const result = await client.query(
        `INSERT INTO projects.alert_thresholds
           (id, organisation_id, alert_type, days_before, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [SEED_ORGANISATION_ID, t.alertType, t.daysBefore]
      );
      if (result.rowCount && result.rowCount > 0) thresholdCount++;
    }

    await client.query("COMMIT");

    console.log("Seed complete.");
    console.log(`  Organisation : ${SEED_ORGANISATION_ID}`);
    console.log(`  User (Bernie): ${SEED_USER_ID}`);
    console.log(`  Test project : ${TEST_PROJECT_ID}`);
    console.log(`  Cost codes   : ${costCodeCount} inserted (${COST_CODES.length} total)`);
    console.log(`  Ins. types   : ${insTypeCount} inserted`);
    console.log(`  Payment terms: ${ptCount} inserted`);
    console.log(`  Thresholds   : ${thresholdCount} inserted`);
    console.log("");
    console.log("ACTION REQUIRED: Update clerk_id on seed user after first Clerk login:");
    console.log(`  UPDATE projects.users SET clerk_id = '<your-clerk-id>' WHERE id = '${SEED_USER_ID}';`);
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
