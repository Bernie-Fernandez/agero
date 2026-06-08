import { requireFinanceAccess } from '@/lib/auth';
import { getCVRSummary } from '@/lib/cvr/actions';
import CVRClient from './CVRClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'CVR | Finance' };

export default async function CVRPage() {
  await requireFinanceAccess();
  const result = await getCVRSummary();

  if (!result.ok || !result.rows) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-zinc-900 mb-4">CVR — Cost Value Reconciliation</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {result.error ?? 'Failed to load CVR data.'}
        </div>
      </div>
    );
  }

  return <CVRClient rows={result.rows} latestMonth={result.latestMonth ?? null} />;
}
