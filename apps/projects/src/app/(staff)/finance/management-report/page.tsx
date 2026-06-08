import { requireFinanceAccess } from '@/lib/auth';
import { getReportData } from '@/lib/management-report/actions';
import MgmtReportClient from './MgmtReportClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Management Report | Finance' };

export default async function ManagementReportPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string };
}) {
  await requireFinanceAccess();
  const sp = await searchParams;
  const year = sp.year ? Number(sp.year) : undefined;
  const month = sp.month ? Number(sp.month) : undefined;

  const result = await getReportData(year, month);

  if (!result.ok || !result.data) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-zinc-900 mb-4">Management Report</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {result.error ?? 'Failed to load management report data.'}
        </div>
      </div>
    );
  }

  return <MgmtReportClient initialData={result.data} />;
}
