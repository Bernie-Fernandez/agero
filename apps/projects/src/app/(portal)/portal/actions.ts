'use server';
import { prisma } from '@/lib/prisma';
import { PortalInvitationStatus } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { clerkClient } from '@clerk/nextjs/server';

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

  const invitation = await prisma.portalInvitation.findUnique({
    where: { token },
    include: { company: { select: { id: true, name: true } } },
  });
  if (!invitation || invitation.status !== PortalInvitationStatus.PENDING || invitation.expiresAt < new Date()) {
    redirect(`/portal/register/${token}?error=invalid-token`);
  }

  const clerk = await clerkClient();

  // Check if Clerk user already exists with this email
  const existingUsers = await clerk.users.getUserList({ emailAddress: [email] });
  let clerkUserId: string;

  if (existingUsers.totalCount > 0) {
    const existingUser = existingUsers.data[0];
    const existingRole = existingUser.publicMetadata?.role as string | undefined;
    if (existingRole && existingRole !== 'PORTAL') {
      redirect(`/portal/register/${token}?error=staff-account`);
    }
    clerkUserId = existingUser.id;
    // Update metadata if not already set
    if (existingRole !== 'PORTAL') {
      await clerk.users.updateUserMetadata(clerkUserId, {
        publicMetadata: { role: 'PORTAL', companyId: invitation.companyId },
      });
    }
  } else {
    // Create new Clerk user
    const clerkUser = await clerk.users.createUser({
      firstName,
      lastName,
      emailAddress: [email],
      password,
      publicMetadata: { role: 'PORTAL', companyId: invitation.companyId },
    });
    clerkUserId = clerkUser.id;
  }

  // Create or update PortalUser record
  await prisma.portalUser.upsert({
    where: { email },
    update: { clerkUserId, firstName, lastName, mobile, isActive: true },
    create: {
      companyId: invitation.companyId,
      clerkUserId,
      firstName,
      lastName,
      email,
      mobile,
      passwordHash: null,
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

  redirect('/portal/login?registered=1');
}

export async function addPortalWorker(formData: FormData, companyId: string) {
  const firstName = (formData.get('firstName') as string)?.trim();
  const lastName = (formData.get('lastName') as string)?.trim();
  const mobile = (formData.get('mobile') as string)?.trim();
  const email = (formData.get('email') as string)?.trim() || null;
  const trade = (formData.get('trade') as string)?.trim() || null;

  if (!firstName || !lastName || !mobile) return { ok: false, error: 'First name, last name and mobile are required' };

  const { prisma: safetyPrisma } = await import('@/lib/safety/prisma');
  const existing = await safetyPrisma.workerAccount.findFirst({ where: { mobile } });
  if (existing) return { ok: false, error: 'This mobile number is already registered.' };

  await safetyPrisma.workerAccount.create({
    data: { mobile, firstName, lastName, trades: trade ? [trade] : [] },
  });

  return { ok: true };
}
