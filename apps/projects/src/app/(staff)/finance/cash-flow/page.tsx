import { requireFinanceAccess } from '@/lib/auth';
import { getCashFlowPageData } from '@/lib/cash-flow/actions';
import CashFlowClient from './CashFlowClient';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cash Flow Forecast | Finance' };

export default async function CashFlowPage() {
  await requireFinanceAccess();
  const result = await getCashFlowPageData();

  if (!result.ok || !result.data) {
    return (
      <div className="p-6 max-w-4xl">
        <h1 className="text-xl font-bold text-zinc-900 mb-4">Cash Flow Forecast</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {result.error ?? 'Failed to load cash flow data.'}
          {!result.data && (
            <span className="ml-2">
              <Link href="/finance/balance-sheet" className="underline">Sync the Balance Sheet</Link> first to provide opening balance data.
            </span>
          )}
        </div>
      </div>
    );
  }

  return <CashFlowClient initialData={result.data} />;
}
