import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireDirector } from '@/lib/auth';
import { ROLE_METADATA, getRolePreset } from '@agero/db';
import UserDetailClient from './UserDetailClient';

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireDirector();
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: { trainingRecords: { orderBy: { completedDate: 'desc' } } },
  });
  if (!user) notFound();

  const roleMeta = ROLE_METADATA[user.role as keyof typeof ROLE_METADATA] as { label: string; tier: string; stream: string } | undefined;
  const rolePreset = getRolePreset(user.role) as { modules: Record<string, string>; maf: Record<string, { state: string; limit: number }> };
  const roles = Object.entries(ROLE_METADATA).map(([value, meta]) => ({
    value,
    label: meta.label,
    tier: meta.tier,
    stream: meta.stream,
  }));

  return <UserDetailClient user={user as never} roleMeta={roleMeta} rolePreset={rolePreset} roles={roles} />;
}
