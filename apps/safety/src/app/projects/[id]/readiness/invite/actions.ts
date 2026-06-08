"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { sendWorkerInviteSms } from "@/lib/sms";
import { getAppUrl } from "@/lib/app-url";

export type InviteState = { error?: string };

export async function sendInvitations(
  safetyProjectId: string,
  erpProjectId: string,
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const user = await requireRole(AGERO_ROLES);

  const orgId = formData.get("organisationId")?.toString();
  const mobilesRaw = formData.get("mobiles")?.toString() ?? "";

  if (!orgId) return { error: "Please select a subcontractor organisation." };

  const mobiles = mobilesRaw
    .split(/[\n,]+/)
    .map((s) => s.replace(/\s/g, ""))
    .filter(Boolean);

  if (mobiles.length === 0) return { error: "Please enter at least one mobile number." };
  if (mobiles.length > 20) return { error: "Too many numbers — maximum 20 per batch." };

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id: safetyProjectId },
    select: { id: true, name: true },
  });
  if (!safetyProject) return { error: "Project not found." };

  const host = getAppUrl();
  const invitedBy = user.name ?? user.email;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  for (const mobile of mobiles) {
    const token = randomUUID();
    await prisma.workerInvitation.create({
      data: {
        projectId: safetyProjectId,
        organisationId: orgId,
        mobile,
        invitedBy,
        token,
        expiresAt,
      },
    });
    try {
      await sendWorkerInviteSms(mobile, safetyProject.name, `${host}/mob-checklist/${token}`);
    } catch {
      // Non-fatal — invitation record exists; worker can be resent manually
    }
  }

  redirect(`/projects/${erpProjectId}/readiness/invite`);
}
