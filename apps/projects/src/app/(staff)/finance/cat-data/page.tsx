import { requireDirector } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import CatDataClient from './CatDataClient';

export const metadata = { title: 'CAT Data | Finance' };

export default async function CatDataPage({
  searchParams,
}: {
  searchParams: Promise<{ asAt?: string; status?: string }>;
}) {
  const user = await requireDirector();
  const params = await searchParams;

  // Available months with data
  const months = await prisma.financeProjectSnapshot.findMany({
    where: { organisationId: user.organisationId },
    select: { asAtDate: true },
    distinct: ['asAtDate'],
    orderBy: { asAtDate: 'desc' },
  });

  const monthList = months.map((m) => m.asAtDate.toISOString().split('T')[0]);

  // Determine selected month
  const selectedMonth = params.asAt && monthList.includes(params.asAt)
    ? params.asAt
    : monthList[0] ?? null;

  // Load snapshots for the selected month
  const snapshots = selectedMonth
    ? await prisma.financeProjectSnapshot.findMany({
        where: {
          organisationId: user.organisationId,
          asAtDate: new Date(selectedMonth),
        },
        include: {
          importedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ status: 'asc' }, { jobNo: 'asc' }],
      })
    : [];

  // Import history
  const importHistory = await prisma.catImport.findMany({
    where: { organisationId: user.organisationId },
    include: { uploadedBy: { select: { firstName: true, lastName: true } } },
    orderBy: { uploadedAt: 'desc' },
    take: 50,
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">CAT Data</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Imported project financial snapshots from CAT Cloud.
          </p>
        </div>
        <a
          href="/finance/cat-import"
          className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors"
        >
          + New Import
        </a>
      </div>

      <CatDataClient
        months={monthList}
        selectedMonth={selectedMonth}
        snapshots={JSON.parse(JSON.stringify(snapshots))}
        importHistory={JSON.parse(JSON.stringify(importHistory))}
      />
    </div>
  );
}
