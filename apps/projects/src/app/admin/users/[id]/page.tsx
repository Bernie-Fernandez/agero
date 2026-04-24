import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireDirector } from '@/lib/auth';
import UserDetailClient from './UserDetailClient';

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireDirector();
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: { trainingRecords: { orderBy: { completedDate: 'desc' } } },
  });
  if (!user) notFound();

  return <UserDetailClient user={user as never} />;
}
