import { requireDirector } from '@/lib/auth';
import { getBudgetData } from '@/lib/planned-work-budget/actions';
import { listActiveCurves } from '@/lib/revenue-curves/actions';
import { PlannedWorkBudgetClient } from './PlannedWorkBudgetClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Planned Work Budget | Finance' };

export default async function PlannedWorkBudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string }>;
}) {
  await requireDirector();
  const sp = await searchParams;
  const fy = sp.fy ? Number(sp.fy) : undefined;

  const [result, curves] = await Promise.all([
    getBudgetData(fy),
    listActiveCurves(),
  ]);

  if (!result.ok || !result.data) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-xl font-semibold text-zinc-900 mb-4">Planned Work Budget</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {result.error ?? 'Failed to load planned work budget.'}
        </div>
      </div>
    );
  }

  return <PlannedWorkBudgetClient initialData={result.data} curves={curves} />;
}
