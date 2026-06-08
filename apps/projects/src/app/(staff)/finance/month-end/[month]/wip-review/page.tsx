import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireDirector } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWipReview } from '@/lib/month-end/actions';
import { WipReviewClient } from './WipReviewClient';

export const dynamic = 'force-dynamic';

export default async function WipReviewPage({
  params,
}: {
  params: Promise<{ month: string }>;
}) {
  const { month } = await params;
  const user = await requireDirector();

  const [year, mon] = month.split('-').map(Number);
  if (!year || !mon) notFound();
  const reportMonth = new Date(Date.UTC(year, mon - 1, 1));

  const record = await prisma.monthEndStatus.findUnique({
    where: {
      organisationId_reportMonth: {
        organisationId: user.organisationId,
        reportMonth,
      },
    },
    select: { id: true, status: true },
  });

  if (!record) notFound();

  // Status must be WIP_CALCULATED or beyond (but not LOCKED, which is view-only)
  const wipStatuses = ['WIP_CALCULATED', 'WIP_REVIEWED', 'JOURNAL_POSTED', 'XERO_RESYNCED', 'LOCKED'];
  if (!wipStatuses.includes(record.status)) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link href="/finance/month-end" className="text-sm text-zinc-500 hover:text-zinc-700">← Month-end</Link>
        <p className="mt-4 text-sm text-zinc-600">
          WIP has not been calculated for this month yet. Go back and click &quot;Calculate WIP&quot; first.
        </p>
      </div>
    );
  }

  const result = await getWipReview(record.id);
  if (!result.ok || !result.data) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <p className="text-sm text-red-500">{result.error ?? 'Failed to load WIP review.'}</p>
      </div>
    );
  }

  const monthLabel = new Date(reportMonth).toLocaleDateString('en-AU', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <Link href="/finance/month-end" className="text-sm text-zinc-500 hover:text-zinc-700">← Month-end</Link>
      <h1 className="mt-2 text-xl font-semibold text-zinc-900">WIP Review — {monthLabel}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Review per-project WIP positions, apply overrides, and approve the journal for posting to Xero.
      </p>
      <WipReviewClient data={result.data} monthParam={month} />
    </div>
  );
}
