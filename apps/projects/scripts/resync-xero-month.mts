/**
 * Re-run the Month Status "Sync Xero" pull for a single month, using the exact
 * same code path as the API route (`syncXeroMonth` from src/lib/xero/month-sync.ts).
 *
 * This exists because the route itself is behind a Clerk Director session, so it
 * cannot be invoked from a terminal. Everything after the auth check is shared.
 *
 * Safety rails:
 *   - refuses to run against a LOCKED month
 *   - refuses to run unless the month is explicitly passed as YYYY-MM
 *   - requires --confirm to write anything
 *
 * Usage:
 *   npx tsx scripts/resync-xero-month.ts 2026-05 --confirm
 *
 * Requires in apps/projects/.env.local:
 *   DATABASE_URL, XERO_CLIENT_ID, XERO_CLIENT_SECRET, XERO_REDIRECT_URI, XERO_TOKEN_SECRET
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });

const arg = process.argv[2];
const confirmed = process.argv.includes('--confirm');

if (!arg || !/^\d{4}-\d{2}$/.test(arg)) {
  console.error('Usage: npx tsx scripts/resync-xero-month.ts YYYY-MM [--confirm]');
  process.exit(1);
}

const [year, month] = arg.split('-').map(Number);
const monthKey = new Date(Date.UTC(year, month - 1, 1));

const missing = ['DATABASE_URL', 'XERO_CLIENT_ID', 'XERO_CLIENT_SECRET', 'XERO_TOKEN_SECRET'].filter(
  (k) => !process.env[k],
);
if (missing.length) {
  console.error(`Missing env var(s): ${missing.join(', ')}`);
  process.exit(1);
}

const { prisma } = await import('@/lib/prisma');
const { syncXeroMonth } = await import('@/lib/xero/month-sync');

const label = monthKey.toLocaleDateString('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const org = await prisma.organisation.findFirst({ select: { id: true, name: true } });
if (!org) throw new Error('No organisation found.');

const status = await prisma.monthEndStatus.findUnique({
  where: { organisationId_reportMonth: { organisationId: org.id, reportMonth: monthKey } },
});
if (!status) throw new Error(`No MonthEndStatus row for ${label}.`);
if (status.status === 'LOCKED') throw new Error(`${label} is LOCKED — refusing to re-sync.`);

const before = await prisma.xeroPnL.findUnique({
  where: { organisationId_reportMonth: { organisationId: org.id, reportMonth: monthKey } },
});

console.log(`Organisation : ${org.name}`);
console.log(`Month        : ${label} (status ${status.status})`);
console.log(
  `Before       : revenue ${before?.revenue ?? '—'} | net ${before?.netProfitBeforeTax ?? '—'} | debtor days ${before?.debtorDays ?? '—'}`,
);

if (!confirmed) {
  console.log('\nDry run — pass --confirm to write. Nothing was changed.');
  await prisma.$disconnect();
  process.exit(0);
}

const result = await syncXeroMonth(org.id, monthKey);
if (!result.ok) {
  console.error(`\nSync failed (${result.status}): ${result.error}`);
  await prisma.$disconnect();
  process.exit(1);
}

await prisma.monthEndStatus.update({
  where: { organisationId_reportMonth: { organisationId: org.id, reportMonth: monthKey } },
  data: { status: 'SYNCED', xeroSyncedAt: new Date() },
});

console.log('\nSync summary:');
console.table(result.summary);

const after = await prisma.xeroPnL.findUnique({
  where: { organisationId_reportMonth: { organisationId: org.id, reportMonth: monthKey } },
});
console.log('\nStored in xero_pnl:');
console.table({
  revenue: after?.revenue?.toString(),
  costOfSales: after?.costOfSales?.toString(),
  grossProfit: after?.grossProfit?.toString(),
  netProfitBeforeTax: after?.netProfitBeforeTax?.toString(),
  tradeDebtors: after?.tradeDebtors?.toString(),
  debtorDays: after?.debtorDays?.toString(),
});

await prisma.$disconnect();
