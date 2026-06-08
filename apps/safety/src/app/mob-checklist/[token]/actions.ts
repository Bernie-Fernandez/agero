"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export type ChecklistState = { error?: string };

export async function submitChecklist(
  token: string,
  _prev: ChecklistState,
  formData: FormData,
): Promise<ChecklistState> {
  const invitation = await prisma.workerInvitation.findUnique({
    where: { token },
    select: { id: true, mobile: true, projectId: true, status: true, expiresAt: true },
  });

  if (!invitation) return { error: "Invalid or expired link." };
  if (invitation.status === "ACCEPTED") return { error: "This checklist has already been completed." };
  if (new Date() > invitation.expiresAt) return { error: "This invitation link has expired. Please contact your supervisor." };

  const firstName = formData.get("firstName")?.toString().trim();
  const lastName = formData.get("lastName")?.toString().trim();
  const whiteCardNo = formData.get("whiteCardNo")?.toString().trim() || null;
  const whiteCardExpiryRaw = formData.get("whiteCardExpiry")?.toString().trim();
  const nokName = formData.get("nokName")?.toString().trim();
  const nokPhone = formData.get("nokPhone")?.toString().trim();
  const nokRelationship = formData.get("nokRelationship")?.toString().trim() || null;

  if (!firstName || !lastName) return { error: "First and last name are required." };
  if (!nokName || !nokPhone) return { error: "Next of kin name and phone number are required." };

  const whiteCardExpiry = whiteCardExpiryRaw ? new Date(whiteCardExpiryRaw) : null;

  await prisma.workerAccount.upsert({
    where: { mobile: invitation.mobile },
    create: {
      mobile: invitation.mobile,
      firstName,
      lastName,
      whiteCardNumber: whiteCardNo,
      whiteCardExpiry,
      nokName,
      nokMobile: nokPhone,
      nokRelationship,
    },
    update: {
      firstName,
      lastName,
      ...(whiteCardNo ? { whiteCardNumber: whiteCardNo } : {}),
      ...(whiteCardExpiry ? { whiteCardExpiry } : {}),
      ...(nokName ? { nokName } : {}),
      ...(nokPhone ? { nokMobile: nokPhone } : {}),
      ...(nokRelationship ? { nokRelationship } : {}),
    },
  });

  await prisma.workerInvitation.update({
    where: { id: invitation.id },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });

  redirect(`/mob-checklist/${token}/done`);
}
