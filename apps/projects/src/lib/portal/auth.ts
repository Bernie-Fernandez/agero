import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

const COOKIE_NAME = 'portal_token';
const SESSION_DAYS = 30;

export type PortalSession = {
  id: string;
  portalUserId: string;
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
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.portalSession.findUnique({
    where: { token },
    include: {
      portalUser: {
        include: { company: { select: { id: true, name: true } } },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) return null;
  return session as unknown as PortalSession;
}

export async function requirePortalSession(): Promise<PortalSession> {
  const session = await getPortalSession();
  if (!session) {
    const { redirect } = await import('next/navigation');
    redirect('/portal/login');
  }
  return session as PortalSession;
}

export async function createPortalSession(portalUserId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  const session = await prisma.portalSession.create({ data: { portalUserId, expiresAt } });
  return session.token;
}

export async function setPortalSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DAYS * 86400,
    path: '/',
  });
}

export async function clearPortalSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
