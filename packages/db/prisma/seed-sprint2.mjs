import "dotenv/config";
import pg from "pg";
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SEED_ORG_ID = "a1000000-0000-0000-0000-000000000001";
const SEED_USER_ID = "b2000000-0000-0000-0000-000000000001";
const TEST_PROJECT_ID = "9b64a2a7-f8fe-4b51-8c44-d5f550e35a3c";

const COST_CODES = [
  { gc: "1000", gn: "Client",               cc: "1000", desc: "Project Income",              gl: "2001",  type: "REVENUE",       trade: false, notes: "All Project Related Income" },
  { gc: "1000", gn: "Client",               cc: "1100", desc: "Other Income",                gl: "2004",  type: "REVENUE",       trade: false, notes: "Not Project Related" },
  { gc: "2000", gn: "Time",                 cc: "2110", desc: "Annual Leave",                gl: null,    type: "TIME_CODE",     trade: false, notes: "Annual Leave - No GL Code Required" },
  { gc: "2000", gn: "Time",                 cc: "2120", desc: "Statutory Leave",             gl: null,    type: "TIME_CODE",     trade: false, notes: "Public Holidays - No GL Code Required" },
  { gc: "2000", gn: "Time",                 cc: "2130", desc: "Sick Leave",                  gl: null,    type: "TIME_CODE",     trade: false, notes: "Sick Leave - No GL Code Required" },
  { gc: "2000", gn: "Time",                 cc: "2140", desc: "Study Leave",                 gl: null,    type: "TIME_CODE",     trade: false, notes: "Study Leave - No GL Code Required" },
  { gc: "2000", gn: "Time",                 cc: "2150", desc: "Special Leave",               gl: null,    type: "TIME_CODE",     trade: false, notes: "Special Leave - No GL Code Required" },
  { gc: "2000", gn: "Time",                 cc: "2310", desc: "Proj - Scope, Bidding",       gl: null,    type: "TIME_CODE",     trade: false, notes: "Tendering Related - No GL Code Required" },
  { gc: "2000", gn: "Time",                 cc: "2320", desc: "BD - Prospect New Client",    gl: null,    type: "TIME_CODE",     trade: false, notes: "Marketing Related - No GL Code Required" },
  { gc: "2000", gn: "Time",                 cc: "2321", desc: "BD - Strat. Part/Network",    gl: null,    type: "TIME_CODE",     trade: false, notes: "Strategic Partner / Networking" },
  { gc: "2000", gn: "Time",                 cc: "2322", desc: "BD - Scope, Des, Estimate",   gl: null,    type: "TIME_CODE",     trade: false, notes: "New client quoting or design" },
  { gc: "2000", gn: "Time",                 cc: "2325", desc: "Acc Mgmt - Scope, Des, Es",   gl: null,    type: "TIME_CODE",     trade: false, notes: "Existing customers" },
  { gc: "2000", gn: "Time",                 cc: "2326", desc: "Marketing - Mgmt, Content",   gl: null,    type: "TIME_CODE",     trade: false, notes: "Marketing - Mgmt, Content" },
  { gc: "2000", gn: "Time",                 cc: "2410", desc: "Director - Strat, Growth",    gl: null,    type: "TIME_CODE",     trade: false, notes: "Administration Related - No GL Code Required" },
  { gc: "2000", gn: "Time",                 cc: "2418", desc: "Admin - HR",                  gl: null,    type: "TIME_CODE",     trade: false, notes: "HR" },
  { gc: "2000", gn: "Time",                 cc: "2420", desc: "Admin - Accounts, Legal",     gl: null,    type: "TIME_CODE",     trade: false, notes: "Accounts related activity - No GL required" },
  { gc: "3100", gn: "Site Prep",            cc: "3110", desc: "Demolition",                  gl: "462",   type: "JOB_COST",      trade: true,  notes: "Subcontract, Plant, Materials & Labour" },
  { gc: "3800", gn: "Construction",         cc: "3805", desc: "Carpentry/Partitions",         gl: "462",   type: "JOB_COST",      trade: true,  notes: "Subcontract, Plant, Materials & Labour" },
  { gc: "3800", gn: "Construction",         cc: "3830", desc: "Construction General",         gl: "462",   type: "JOB_COST",      trade: true,  notes: "Generic Construction - Subcontract, Plant, Materials & Labour" },
  { gc: "3849", gn: "Painting",             cc: "3850", desc: "Paint Finish",                 gl: "462",   type: "JOB_COST",      trade: true,  notes: "Subcontract, Plant, Materials & Labour" },
  { gc: "3900", gn: "Floor Finishes",       cc: "3905", desc: "Carpet & Vinyl",              gl: "462",   type: "JOB_COST",      trade: true,  notes: "Subcontract, Plant, Materials & Labour" },
  { gc: "3900", gn: "Floor Finishes",       cc: "3910", desc: "Concrete Floor Finishes",     gl: "462",   type: "JOB_COST",      trade: true,  notes: "Subcontract, Plant, Materials & Labour" },
  { gc: "3900", gn: "Floor Finishes",       cc: "3940", desc: "Tiling",                      gl: "462",   type: "JOB_COST",      trade: true,  notes: "Subcontract, Plant, Materials & Labour" },
  { gc: "4100", gn: "Services",             cc: "4105", desc: "Electrical Contractor",        gl: "462",   type: "JOB_COST",      trade: true,  notes: "Subcontract, Plant, Materials & Labour" },
  { gc: "4100", gn: "Services",             cc: "4110", desc: "Plumbing Contractor",          gl: "462",   type: "JOB_COST",      trade: true,  notes: "Subcontract, Plant, Materials & Labour" },
  { gc: "4100", gn: "Services",             cc: "4115", desc: "Mechanical Contractor",        gl: "462",   type: "JOB_COST",      trade: true,  notes: "Subcontract, Plant, Materials & Labour" },
  { gc: "4100", gn: "Services",             cc: "4125", desc: "Fire Contractor",              gl: "462",   type: "JOB_COST",      trade: true,  notes: "Subcontract, Plant, Materials & Labour" },
  { gc: "4100", gn: "Services",             cc: "4135", desc: "Security",                     gl: "462",   type: "JOB_COST",      trade: true,  notes: "Subcontract, Plant, Materials & Labour" },
  { gc: "4200", gn: "Joinery",              cc: "4205", desc: "Joinery",                      gl: "462",   type: "JOB_COST",      trade: true,  notes: "Subcontract, Plant, Materials & Labour" },
  { gc: "4300", gn: "Furniture",            cc: "4305", desc: "Furniture",                    gl: "462",   type: "JOB_COST",      trade: true,  notes: "Subcontract, Plant, Materials & Labour" },
  { gc: "4400", gn: "FFE",                  cc: "4415", desc: "FFE Fit. Fix. Equip",          gl: "462",   type: "JOB_COST",      trade: true,  notes: "Subcontract, Plant, Materials & Labour" },
  { gc: "4500", gn: "Finishing",            cc: "4505", desc: "Signage",                      gl: "462",   type: "JOB_COST",      trade: true,  notes: "Subcontract, Plant, Materials & Labour" },
  { gc: "4500", gn: "Finishing",            cc: "4510", desc: "Blinds",                       gl: "462",   type: "JOB_COST",      trade: true,  notes: "Subcontract, Plant, Materials & Labour" },
  { gc: "4600", gn: "Cleaning",             cc: "4605", desc: "Cleaning",                     gl: "462",   type: "JOB_COST",      trade: true,  notes: "Subcontract, Plant, Materials & Labour" },
  { gc: "9000", gn: "Contract Margin",      cc: "9000", desc: "Contract Margin",              gl: null,    type: "JOB_COST",      trade: false, notes: "No GL Code Required, for job costing only" },
  { gc: "9600", gn: "Internal Plant",       cc: "9600", desc: "Internal Plant Charges",       gl: "9600",  type: "JOB_COST",      trade: false, notes: "System - All internal plant charges, no GL required" },
  { gc: "9100", gn: "Retention Code",       cc: "9100", desc: "Retentions Held On Us",        gl: "9100",  type: "RETENTION",     trade: false, notes: "System - Calc for Client Claims (held)" },
  { gc: "9100", gn: "Retention Code",       cc: "9200", desc: "Retentions Released to Us",    gl: "9200",  type: "RETENTION",     trade: false, notes: "System - Calc for Client Claims (paid)" },
  { gc: "9100", gn: "Retention Code",       cc: "9300", desc: "Retentions Held on Subs",      gl: "9300",  type: "RETENTION",     trade: false, notes: "System - Calc for Subcontractor Claims (held)" },
  { gc: "9100", gn: "Retention Code",       cc: "9400", desc: "Retentions Paid to Subs",      gl: "9400",  type: "RETENTION",     trade: false, notes: "System - Calc for Subcontractor Claims (paid)" },
  { gc: "4900", gn: "Project Team",         cc: "4925", desc: "Structural Engineer",          gl: "4623",  type: "PRELIMINARIES", trade: false, notes: "Consultant" },
  { gc: "4900", gn: "Project Team",         cc: "4945", desc: "Services Engineering",         gl: "4623",  type: "PRELIMINARIES", trade: false, notes: "Consultant" },
  { gc: "4900", gn: "Project Team",         cc: "4950", desc: "Other Engineering",            gl: "4623",  type: "PRELIMINARIES", trade: false, notes: "Consultant" },
  { gc: "4900", gn: "Project Team",         cc: "4970", desc: "Inter. Des. / Architect",      gl: "4622",  type: "PRELIMINARIES", trade: false, notes: "Consultant" },
  { gc: "4900", gn: "Project Team",         cc: "4990", desc: "Building Surveyor",            gl: "4626",  type: "PRELIMINARIES", trade: false, notes: "Consultant" },
  { gc: "4900", gn: "Project Team",         cc: "4997", desc: "Main Contractor",              gl: "462",   type: "PRELIMINARIES", trade: false, notes: "Main Contractor" },
  { gc: "5200", gn: "PG Preliminaries",     cc: "5210", desc: "DEL Preliminaries",            gl: "4629",  type: "PRELIMINARIES", trade: false, notes: "Prelims" },
  { gc: "5200", gn: "PG Preliminaries",     cc: "5211", desc: "PREC Preliminaries",           gl: "4629",  type: "PRELIMINARIES", trade: false, notes: "Precon Prelims" },
  { gc: "5400", gn: "PG Our Project Staff", cc: "5410", desc: "PREC Project Manage.",         gl: "377",   type: "PRELIMINARIES", trade: false, notes: "Precon. Proj. Management" },
  { gc: "5400", gn: "PG Our Project Staff", cc: "5440", desc: "DEL Project Management",       gl: "377",   type: "PRELIMINARIES", trade: false, notes: "Agero Attendance" },
  { gc: "5400", gn: "PG Our Project Staff", cc: "5450", desc: "DEL Site Management",          gl: "377",   type: "PRELIMINARIES", trade: false, notes: "Agero Attendance" },
  { gc: "5400", gn: "PG Our Project Staff", cc: "5460", desc: "PRECON Project Management",    gl: "377",   type: "PRELIMINARIES", trade: false, notes: "Agero Attendance" },
  { gc: "5400", gn: "PG Our Project Staff", cc: "5470", desc: "DEL Labourer",                 gl: "377",   type: "PRELIMINARIES", trade: false, notes: "Agero Attendance" },
  { gc: "5500", gn: "PG Overhead",          cc: "5516", desc: "DEL Overhead",                 gl: "4629",  type: "PRELIMINARIES", trade: false, notes: "Delivery stage alloc. overhead" },
  { gc: "5500", gn: "PG Overhead",          cc: "5517", desc: "PREC. Overhead",               gl: "4629",  type: "PRELIMINARIES", trade: false, notes: "PREC stage alloc. overheads" },
  { gc: "7000", gn: "General Overhead",     cc: "5515", desc: "Overhead Job Only",            gl: "4629",  type: "OVERHEAD",      trade: false, notes: "Overhead costs" },
];

const INSURANCE_TYPES = [
  { name: "Public Liability",       description: "Covers third-party bodily injury and property damage claims", isMandatory: true,  displayOrder: 1 },
  { name: "Workers Compensation",   description: "Covers work-related injuries and illnesses to employees",    isMandatory: true,  displayOrder: 2 },
  { name: "Contract Works",         description: "Covers the works during construction against damage or loss", isMandatory: false, displayOrder: 3 },
  { name: "Professional Indemnity", description: "Covers claims arising from professional advice or services",  isMandatory: false, displayOrder: 4 },
  { name: "Contractors All Risk",   description: "Broad coverage for contractor activities and equipment",      isMandatory: false, displayOrder: 5 },
];

const PAYMENT_TERMS = [
  { name: "7 Days",       description: "Payment due within 7 days of invoice",          isDefault: false, displayOrder: 1 },
  { name: "14 Days",      description: "Payment due within 14 days of invoice",         isDefault: false, displayOrder: 2 },
  { name: "30 Days",      description: "Payment due within 30 days of invoice",         isDefault: true,  displayOrder: 3 },
  { name: "45 Days",      description: "Payment due within 45 days of invoice",         isDefault: false, displayOrder: 4 },
  { name: "End of Month", description: "Payment due at end of the invoice month",       isDefault: false, displayOrder: 5 },
  { name: "7 Days EOM",   description: "Payment due 7 days after end of invoice month", isDefault: false, displayOrder: 6 },
];

const ALERT_THRESHOLDS = [
  { alertType: "INSURANCE_EXPIRY", daysBefore: 90 },
  { alertType: "INSURANCE_EXPIRY", daysBefore: 60 },
  { alertType: "INSURANCE_EXPIRY", daysBefore: 30 },
  { alertType: "DOCUMENT_EXPIRY",  daysBefore: 90 },
  { alertType: "DOCUMENT_EXPIRY",  daysBefore: 60 },
  { alertType: "DOCUMENT_EXPIRY",  daysBefore: 30 },
];

const client = await pool.connect();
try {
  await client.query("BEGIN");

  // Sprint 1
  await client.query(
    "INSERT INTO projects.organisations (id,name,abn,primary_email,created_at,updated_at) VALUES ($1,$2,$3,$4,NOW(),NOW()) ON CONFLICT (id) DO NOTHING",
    [SEED_ORG_ID, "Agero Group Pty Ltd", "12345678901", "bfernandez@agero.com.au"]
  );
  await client.query(
    "INSERT INTO projects.users (id,clerk_id,organisation_id,first_name,last_name,email,role,is_active,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,true,NOW(),NOW()) ON CONFLICT (id) DO NOTHING",
    [SEED_USER_ID, "REPLACE_WITH_CLERK_USER_ID", SEED_ORG_ID, "Bernard", "Fernandez", "bfernandez@agero.com.au", "DIRECTOR"]
  );
  await client.query(
    "INSERT INTO projects.projects (id,organisation_id,name,project_number,status,address_street,address_suburb,address_state,address_postcode,created_by_id,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW()) ON CONFLICT (id) DO NOTHING",
    [TEST_PROJECT_ID, SEED_ORG_ID, "L16/350 Queen Street Fitout", "L16-350Q", "ACTIVE", "350 Queen Street", "Melbourne", "VIC", "3000", SEED_USER_ID]
  );

  // Sprint 2 — Cost Codes
  let cc = 0;
  for (let i = 0; i < COST_CODES.length; i++) {
    const c = COST_CODES[i];
    const r = await client.query(
      "INSERT INTO projects.cost_codes (id,organisation_id,group_code,group_name,cat_code,code_description,gl_code,code_type,is_trade_category,is_active,display_order,notes,created_at,updated_at) VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10,NOW(),NOW()) ON CONFLICT (cat_code) DO NOTHING",
      [SEED_ORG_ID, c.gc, c.gn, c.cc, c.desc, c.gl, c.type, c.trade, i + 1, c.notes]
    );
    if (r.rowCount > 0) cc++;
  }

  // Insurance Types
  let it = 0;
  for (const t of INSURANCE_TYPES) {
    const r = await client.query(
      "INSERT INTO projects.insurance_policy_types (id,organisation_id,name,description,is_mandatory,is_active,display_order,created_at,updated_at) VALUES (gen_random_uuid(),$1,$2,$3,$4,true,$5,NOW(),NOW()) ON CONFLICT DO NOTHING",
      [SEED_ORG_ID, t.name, t.description, t.isMandatory, t.displayOrder]
    );
    if (r.rowCount > 0) it++;
  }

  // Payment Terms
  let pt = 0;
  for (const p of PAYMENT_TERMS) {
    const r = await client.query(
      "INSERT INTO projects.payment_terms (id,organisation_id,name,description,is_default,is_active,display_order,created_at,updated_at) VALUES (gen_random_uuid(),$1,$2,$3,$4,true,$5,NOW(),NOW()) ON CONFLICT DO NOTHING",
      [SEED_ORG_ID, p.name, p.description, p.isDefault, p.displayOrder]
    );
    if (r.rowCount > 0) pt++;
  }

  // Alert Thresholds
  let th = 0;
  for (const t of ALERT_THRESHOLDS) {
    const r = await client.query(
      "INSERT INTO projects.alert_thresholds (id,organisation_id,alert_type,days_before,is_active,created_at,updated_at) VALUES (gen_random_uuid(),$1,$2,$3,true,NOW(),NOW()) ON CONFLICT DO NOTHING",
      [SEED_ORG_ID, t.alertType, t.daysBefore]
    );
    if (r.rowCount > 0) th++;
  }

  await client.query("COMMIT");
  console.log("Seed complete.");
  console.log("  Cost codes   :", cc, "inserted (" + COST_CODES.length + " total)");
  console.log("  Ins. types   :", it, "inserted");
  console.log("  Payment terms:", pt, "inserted");
  console.log("  Thresholds   :", th, "inserted");
  console.log("");
  console.log("ACTION REQUIRED: Update clerk_id on seed user after first Clerk login:");
  console.log("  UPDATE projects.users SET clerk_id = '<your-clerk-id>' WHERE id = '" + SEED_USER_ID + "';");
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
} finally {
  client.release();
  await pool.end();
}
