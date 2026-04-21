import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export type PortalSession = {
  clerkUserId: string;
  portalUser: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    companyId: string;
    company: { id: string; name: string };
  };
};

export async function getPortalSession(): Promise<PortalSession | null> {
  const { userId, sessionClaims } = await auth();
  if (!userId) return null;

  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  if (role !== 'PORTAL') return null;

  const portalUser = await prisma.portalUser.findUnique({
    where: { clerkUserId: userId },
    include: { company: { select: { id: true, name: true } } },
  });

  if (!portalUser) return null;

  return {
    clerkUserId: userId,
    portalUser: {
      id: portalUser.id,
      firstName: portalUser.firstName,
      lastName: portalUser.lastName,
      email: portalUser.email,
      companyId: portalUser.companyId,
      company: portalUser.company,
    },
  };
}

export async function requirePortalSession(): Promise<PortalSession> {
  const session = await getPortalSession();
  if (!session) redirect('/portal/login');
  return session;
}
