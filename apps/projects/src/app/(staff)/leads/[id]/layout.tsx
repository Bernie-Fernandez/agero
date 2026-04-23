import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { notFound } from 'next/navigation';
import LeadDetailTopbar from './LeadDetailTopbar';

export default async function LeadDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAppUser();

  const estimate = await prisma.estimate.findFirst({
    where: { id, organisationId: user.organisationId },
    select: {
      id: true,
      leadNumber: true,
      title: true,
      status: true,
      client: { select: { name: true } },
    },
  });

  if (!estimate) notFound();

  return (
    <div className="flex flex-col h-[calc(100vh-48px)]">
      <LeadDetailTopbar estimate={estimate} />
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
