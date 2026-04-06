"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { sendInvitationEmail } from "@/lib/email";
import { randomUUID } from "crypto";

export type InviteState = { error?: string; success?: boolean };

export async function sendInvitation(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const appUser = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    include: { organisation: true },
  });
  if (!appUser) redirect("/onboarding");

  const companyName = formData.get("companyName")?.toString().trim();
  const contactName = formData.get("contactName")?.toString().trim();
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const mobile = formData.get("mobile")?.toString().trim() || null;
  const tradeCategories = formData.getAll("tradeCategories").map(String).filter(Boolean);
  const projectId = formData.get("projectId")?.toString() || null;

  if (!companyName || !contactName || !email) {
    return { error: "Company name, contact name and email are required." };
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

  await prisma.invitation.create({
    data: {
      companyName,
      contactName,
      email,
      mobile,
      tradeCategories,
      projectId: projectId || null,
      token,
      invitedBy: appUser.name ?? appUser.email,
      expiresAt,
    },
  });

  const host = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await sendInvitationEmail({
    to: email,
    contactName,
    companyName,
    invitedBy: appUser.organisation.name,
    registrationUrl: `${host}/register/${token}`,
    expiresAt,
  });

  return { success: true };
}
