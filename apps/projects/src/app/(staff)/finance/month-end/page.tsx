import { requireDirector } from '@/lib/auth';
import { listMonthEndStatuses } from '@/lib/month-end/actions';
import { MonthEndClient } from './MonthEndClient';

export const dynamic = 'force-dynamic';

export default async function MonthEndPage() {
  await requireDirector();
  const result = await listMonthEndStatuses();
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">Month-end</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Manage the month-end workflow: mark ready, calculate WIP, post to Xero, and lock each month.
        </p>
      </div>
      <MonthEndClient initialRows={result.rows ?? []} error={result.error} />
    </div>
  );
}
