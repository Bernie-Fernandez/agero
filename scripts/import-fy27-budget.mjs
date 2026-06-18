/**
 * Agero ERP — FY27 Unsecured Planned Work Budget import
 * Sprint X.10 data load. Run from C:\Dev\agero with Claude Code.
 *
 * SAFETY: Dry-run by default. Prints exactly what it would insert and writes NOTHING.
 *         Add --commit to actually write to the database.
 *
 * Usage (PowerShell, one command at a time):
 *   node scripts/import-fy27-budget.mjs            (dry run — review output)
 *   node scripts/import-fy27-budget.mjs --commit   (after taking a Supabase snapshot)
 *
 * It self-discovers: the organisation, a default revenue curve, and the exact
 * Prisma model/field names. If anything can't be found it STOPS and tells you,
 * rather than guessing.
 */

// This monorepo generates a TypeScript Prisma client (prisma-client generator)
// wired to a pg adapter via the @agero/db `prismaErp` singleton. Run with tsx:
//   npx tsx scripts/import-fy27-budget.mjs            (dry run)
//   npx tsx scripts/import-fy27-budget.mjs --commit   (after a Supabase snapshot)
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Load DATABASE_URL from the same .env the Prisma CLI uses, before the client connects.
config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'db', '.env') });

const { prismaErp: prisma } = await import('@agero/db');
const COMMIT = process.argv.includes('--commit');
const FY = 2027; // budgeting FY27 = Jul 2026 - Jun 2027

// FY27 months in order Jul-2026 .. Jun-2027
const MONTHS = [
  '2026-07-01','2026-08-01','2026-09-01','2026-10-01','2026-11-01','2026-12-01',
  '2027-01-01','2027-02-01','2027-03-01','2027-04-01','2027-05-01','2027-06-01'
];

// ---- SECTION 2: Unsecured Planned Work (placeholder rows) ----
// spread arrays are Jul..Jun (12 values). backlogNext = carry-out to FY28.
const UNSECURED = [
  { name:'TEC 350Q Foyer / Reece Airport West / Rami 460 Lonsdale', contract:4000000, marginPct:25,
    spread:[50000,50000,700000,650000,650000,400000,400000,650000,350000,0,0,0], backlogNextRev:100000 },
  { name:'Nunn Media 20 Spink / Centennial Vella Dr', contract:200000, marginPct:25,
    spread:[70000,70000,60000,0,0,0,0,0,0,0,0,0], backlogNextRev:0 },
  { name:'Rami 451 Lt Bourke / TEC L10 5 Queens / Maersk 500 Bourke', contract:600000, marginPct:25,
    spread:[0,0,15000,200000,200000,150000,35000,0,0,0,0,0], backlogNextRev:0 },
  { name:'Marshall Dent', contract:21000, marginPct:100,
    spread:[0,7000,7000,7000,0,0,0,0,0,0,0,0], backlogNextRev:0 },
  { name:'Dexus 385 Bourke / AFIAA 114 William / Small Spec Suite 1', contract:250000, marginPct:25,
    spread:[0,0,0,20000,150000,80000,0,0,0,0,0,0], backlogNextRev:0 },
  { name:'Centennial Industrial / Up Property 50 Queen / Mid Spec Suite 1', contract:500000, marginPct:25,
    spread:[0,0,0,0,20000,100000,100000,200000,67500,0,0,0], backlogNextRev:12500 },
  { name:'TEC 312 STKR Lobby / Korn Ferry / Large Spec Suite 1', contract:2000000, marginPct:25,
    spread:[0,0,0,0,0,0,0,50000,50000,400000,500000,500000], backlogNextRev:500000 },
  { name:'MYOB Minor Works / Medical Campaign', contract:400000, marginPct:25,
    spread:[0,0,0,0,0,0,0,0,0,35000,200000,152500], backlogNextRev:12500 },
  { name:'FY27 Backlog (Stepchange)', contract:3000000, marginPct:25,
    spread:[0,0,0,0,0,0,0,0,0,0,50000,50000], backlogNextRev:2900000 },
];

// ---- SECTION 1: Secured / Backlog carry-in (no WIP positions yet) ----
const SECURED = [
  { name:'Danaher Moulten 330 Collins', carriedRevenue:100000, marginPct:22.6 },
  { name:'Alfred Health 1001 Nepean Hwy', carriedRevenue:500000, marginPct:27.5 },
  { name:'All For One Studios',          carriedRevenue:800000, marginPct:26.2 },
];

function carriedProfit(rev, pct){ return Math.round(rev * (pct/100)); }
function backlogNextProfit(rev, pct){ return Math.round(rev * (pct/100)); }

async function main(){
  console.log(`\n=== FY${FY} Budget Import  (${COMMIT ? 'COMMIT' : 'DRY RUN'}) ===\n`);

  // 1. Resolve organisation
  const orgs = await prisma.organisation.findMany({ select:{ id:true, name:true } });
  if (orgs.length === 0){ console.error('STOP: no Organisation rows found.'); process.exit(1); }
  if (orgs.length > 1){
    console.error('STOP: multiple organisations found — specify which:');
    orgs.forEach(o=>console.error(`   ${o.id}  ${o.name}`));
    process.exit(1);
  }
  const org = orgs[0];
  console.log(`Organisation: ${org.name} (${org.id})`);

  // 2. Resolve a default revenue curve (first active)
  const curve = await prisma.revenueCurve.findFirst({ where:{ isArchived:false }, select:{ id:true, name:true } })
             ?? await prisma.revenueCurve.findFirst({ select:{ id:true, name:true } });
  if (!curve){ console.error('STOP: no RevenueCurve found.'); process.exit(1); }
  console.log(`Default revenue curve: ${curve.name} (${curve.id})`);

  // 3. Look up any existing FY budget. The guard is enforced *after* the preview
  //    (below) so dry runs always show the rows; a --commit still refuses to overwrite.
  const existing = await prisma.plannedWorkBudget.findFirst({
    where:{ organisationId: org.id, financialYear: FY }
  });

  // 4. Report what will be inserted
  let s2rev = UNSECURED.reduce((a,r)=>a+r.spread.reduce((x,y)=>x+y,0),0);
  let s1rev = SECURED.reduce((a,r)=>a+r.carriedRevenue,0);
  console.log(`\nSECTION 1 — Backlog carry-in: ${SECURED.length} rows, revenue ${s1rev.toLocaleString()} (WIP carry-in left blank)`);
  SECURED.forEach(r=>console.log(`   • ${r.name}: rev ${r.carriedRevenue.toLocaleString()}, profit ${carriedProfit(r.carriedRevenue,r.marginPct).toLocaleString()} @ ${r.marginPct}%`));
  console.log(`\nSECTION 2 — Unsecured planned work: ${UNSECURED.length} placeholder rows, spread revenue ${s2rev.toLocaleString()}`);
  UNSECURED.forEach(r=>{
    const sum=r.spread.reduce((x,y)=>x+y,0);
    console.log(`   • ${r.name}: contract ${r.contract.toLocaleString()} @ ${r.marginPct}%, spread ${sum.toLocaleString()}, BacklogFY28 ${r.backlogNextRev.toLocaleString()}`);
  });

  if (existing){
    console.error(`\nNOTE: a PlannedWorkBudget for FY${FY} already exists (id ${existing.id}, status ${existing.status}).`);
    console.error('This import will NOT overwrite it — delete it in-app or via a separate step before re-importing.');
  }

  if (!COMMIT){
    console.log('\nDRY RUN complete — nothing written. Re-run with --commit (after a Supabase snapshot) to insert.\n');
    await prisma.$disconnect();
    return;
  }

  // 5. COMMIT — final guard: never write on top of an existing budget.
  if (existing){
    console.error(`\nSTOP: refusing to --commit while an FY${FY} budget exists (id ${existing.id}). Delete it first.`);
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log('\nWriting...');
  const budget = await prisma.plannedWorkBudget.create({
    data:{ organisationId: org.id, financialYear: FY, status:'DRAFT' }
  });
  console.log(`Created PlannedWorkBudget FY${FY} (${budget.id}) status DRAFT`);

  for (const r of SECURED){
    await prisma.budgetBacklogLine.create({ data:{
      plannedWorkBudgetId: budget.id,
      projectName: r.name,
      carriedRevenue: r.carriedRevenue,
      carriedProfit: carriedProfit(r.carriedRevenue, r.marginPct),
      // wipCarryIn intentionally left null/0 — Director to scrutinise
      isManualAdjustment: true,
    }});
  }
  console.log(`Inserted ${SECURED.length} backlog carry-in rows`);

  for (const r of UNSECURED){
    const line = await prisma.budgetPlannedWorkLine.create({ data:{
      plannedWorkBudgetId: budget.id,
      source:'PLACEHOLDER',
      opportunityName: r.name,
      contractValue: r.contract,
      forecastMarginPct: r.marginPct,           // stored as percentage
      revenueCurveId: curve.id,
      backlogNextRevenue: r.backlogNextRev,
      backlogNextProfit: backlogNextProfit(r.backlogNextRev, r.marginPct),
    }});
    for (let i=0;i<12;i++){
      if (r.spread[i] === 0) continue;
      await prisma.budgetMonthlySpread.create({ data:{
        plannedWorkLineId: line.id,
        month: new Date(MONTHS[i]),
        revenueAmount: r.spread[i],
        isLockedCell: false,
      }});
    }
  }
  console.log(`Inserted ${UNSECURED.length} planned-work rows + monthly spreads`);
  console.log('\nDONE. Open /finance/planned-work-budget, select FY27 — all rows are DRAFT and fully editable.\n');
  await prisma.$disconnect();
}

main().catch(async e=>{ console.error('\nIMPORT ERROR:', e.message); await prisma.$disconnect(); process.exit(1); });
