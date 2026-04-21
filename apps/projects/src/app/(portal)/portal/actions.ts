'use server';
import { prisma } from '@/lib/prisma';
import { createPortalSession, setPortalSessionCookie, clearPortalSessionCookie } from '@/lib/portal/auth';
import { PortalInvitationStatus } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { createHash } from 'crypto';

function hashPassword(password: string): string {
  return createHash('sha256').update(password + (process.env.PORTAL_SECRET ?? 'agero_portal_secret')).digest('hex');
}

export async function portalLogin(formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;

  if (!email || !password) redirect('/portal/login?error=missing');

  const user = await prisma.portalUser.findUnique({
    where: { email },
    include: { company: { select: { id: true, name: true } } },
  });

  if (!user || !user.isActive || user.passwordHash !== hashPassword(password)) {
    redirect('/portal/login?error=invalid');
  }

  const token = await createPortalSession(user.id);
  await setPortalSessionCookie(token);

  // Update portal last login
  await prisma.subcontractorProfile.updateMany({
    where: { companyId: user.companyId },
    data: { portalLastLoginAt: new Date() },
  });

  redirect('/portal/dashboard');
}

export async function portalRegister(formData: FormData) {
  const token = formData.get('token') as string;
  const firstName = (formData.get('firstName') as string)?.trim();
  const lastName = (formData.get('lastName') as string)?.trim();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const mobile = (formData.get('mobile') as string)?.trim() || null;
  const password = formData.get('password') as string;
  const passwordConfirm = formData.get('passwordConfirm') as string;

  if (!firstName || !lastName || !email || !password) redirect(`/portal/register/${token}?error=missing`);
  if (password !== passwordConfirm) redirect(`/portal/register/${token}?error=password-mismatch`);
  if (password.length < 8) redirect(`/portal/register/${token}?error=password-short`);

  const invitation = await prisma.portalInvitation.findUnique({ where: { token } });
  if (!invitation || invitation.status !== PortalInvitationStatus.PENDING || invitation.expiresAt < new Date()) {
    redirect(`/portal/register/${token}?error=invalid-token`);
  }

  // Create portal user
  const user = await prisma.portalUser.create({
    data: {
      companyId: invitation.companyId,
      firstName,
      lastName,
      email,
      mobile,
      passwordHash: hashPassword(password),
    },
  });

  // Mark invitation accepted
  await prisma.portalInvitation.update({
    where: { id: invitation.id },
    data: { status: PortalInvitationStatus.ACCEPTED, acceptedAt: new Date() },
  });

  // Enable portal access on subcontractor profile
  await prisma.subcontractorProfile.upsert({
    where: { companyId: invitation.companyId },
    update: { portalAccessEnabled: true },
    create: { companyId: invitation.companyId, portalAccessEnabled: true },
  });

  const sessionToken = await createPortalSession(user.id);
  await setPortalSessionCookie(sessionToken);
  redirect('/portal/dashboard');
}

export async function portalSignOut() {
  await clearPortalSessionCookie();
  redirect('/portal/login');
}

export async function addPortalWorker(formData: FormData, companyId: string) {
  const firstName = (formData.get('firstName') as string)?.trim();
  const lastName = (formData.get('lastName') as string)?.trim();
  const mobile = (formData.get('mobile') as string)?.trim();
  const email = (formData.get('email') as string)?.trim() || null;
  const trade = (formData.get('trade') as string)?.trim() || null;

  if (!firstName || !lastName || !mobile) return { ok: false, error: 'First name, last name and mobile are required' };

  // Check mobile uniqueness in safety system
  // We use the safety prisma (public schema) for workers
  const { prisma: safetyPrisma } = await import('@/lib/safety/prisma');
  const existing = await safetyPrisma.workerAccount.findFirst({ where: { mobile } });
  if (existing) return { ok: false, error: 'This mobile number is already registered.' };

  // Create worker account in safety schema
  await safetyPrisma.workerAccount.create({
    data: {
      mobile,
      firstName,
      lastName,
      trades: trade ? [trade] : [],
    },
  });

  return { ok: true };
}
