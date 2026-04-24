import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ROLE_METADATA, getRolePreset } from '@agero/db';
import ProfileClient from './ProfileClient';

export default async function ProfilePage() {
  const authUser = await requireAppUser();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: authUser.id },
  });
  const meta = ROLE_METADATA[user.role as keyof typeof ROLE_METADATA];
  const perm = (user.permissions ?? getRolePreset(user.role)) as object;
  return <ProfileClient user={user as never} meta={meta} perm={perm} />;
}
