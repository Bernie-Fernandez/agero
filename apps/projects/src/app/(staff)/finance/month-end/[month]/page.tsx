import { notFound, redirect } from 'next/navigation';
import { requireDirector } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function MonthEndDetailPage({
  params,
}: {
  params: Promise<{ month: string }>;
}) {
  const { month } = await params;
  const user = await requireDirector();

  // month param is "YYYY-MM"
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

  redirect(`/finance/month-end/${month}/wip-review`);
}
