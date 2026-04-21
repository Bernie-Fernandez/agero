'use server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { sendInvitationEmail } from '@/lib/safety/email';
import { getAppUrl } from '@/lib/safety/app-url';
import { randomBytes } from 'crypto';
import { PortalInvitationStatus } from '@/lib/prisma';

export async function inviteSubcontractor(formData: FormData) {
  const user = await requireAppUser();

  const companyId = (formData.get('companyId') as string)?.trim();
  const contactName = (formData.get('contactName') as string)?.trim();
  const email = (formData.get('email') as string)?.trim().toLowerCase();

  if (!companyId || !email) return { ok: false, error: 'Company and email are required' };

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true } });
  if (!company) return { ok: false, error: 'Company not found' };

  // Expire any existing pending invitations for this company/email
  await prisma.portalInvitation.updateMany({
    where: { companyId, email, status: PortalInvitationStatus.PENDING },
    data: { status: PortalInvitationStatus.EXPIRED },
  });

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.portalInvitation.create({
    data: {
      companyId,
      invitedById: user.id,
      email,
      token,
      status: PortalInvitationStatus.PENDING,
      expiresAt,
    },
  });

  const registrationUrl = `${getAppUrl()}/portal/register/${token}`;

  let emailSent = false;
  try {
    await sendInvitationEmail({
      to: email,
      contactName: contactName || email,
      companyName: company.name,
      invitedBy: `${user.firstName} ${user.lastName}`,
      registrationUrl,
      expiresAt,
    });
    emailSent = true;
  } catch {
    // Email failed — return URL so staff can share manually
  }

  revalidatePath('/subcontractors');
  return { ok: true, emailSent, registrationUrl };
}
