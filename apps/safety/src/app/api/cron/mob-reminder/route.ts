import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMobReminderSms } from "@/lib/sms";
import { sendMobReminderEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  // Capture mob dates stored as midnight UTC for any calendar day within the
  // next 8–36 hours — safely covers "tomorrow" regardless of server time zone.
  const windowStart = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 36 * 60 * 60 * 1000);

  const projects = await prisma.safetyProject.findMany({
    where: {
      mobilisationDate: { gte: windowStart, lte: windowEnd },
    },
    select: { id: true, name: true, erpProjectId: true, mobilisationDate: true },
  });

  const host = getAppUrl();
  let smsSent = 0;
  let emailsSent = 0;

  for (const project of projects) {
    const pendingInvitations = await prisma.workerInvitation.findMany({
      where: {
        projectId: project.id,
        status: "PENDING",
        expiresAt: { gt: now },
      },
      select: {
        token: true,
        mobile: true,
        organisationId: true,
        organisation: { select: { name: true } },
      },
    });

    if (pendingInvitations.length === 0) continue;

    // SMS each pending worker
    for (const inv of pendingInvitations) {
      try {
        await sendMobReminderSms(
          inv.mobile,
          project.name,
          `${host}/mob-checklist/${inv.token}`,
        );
        smsSent++;
      } catch {
        console.error(`[mob-reminder] SMS failed for ${inv.mobile} on project ${project.id}`);
      }
    }

    // Group by org → email each org's subcontractor_admin users
    const byOrg = new Map<string, { orgName: string; workers: { mobile: string; checklistUrl: string }[] }>();
    for (const inv of pendingInvitations) {
      if (!byOrg.has(inv.organisationId)) {
        byOrg.set(inv.organisationId, { orgName: inv.organisation.name, workers: [] });
      }
      byOrg.get(inv.organisationId)!.workers.push({
        mobile: inv.mobile,
        checklistUrl: `${host}/mob-checklist/${inv.token}`,
      });
    }

    for (const [orgId, { orgName, workers }] of byOrg) {
      const admins = await prisma.user.findMany({
        where: { organisationId: orgId, role: "subcontractor_admin" },
        select: { email: true, name: true },
      });
      for (const admin of admins) {
        try {
          await sendMobReminderEmail({
            to: admin.email,
            adminName: admin.name,
            orgName,
            projectName: project.name,
            mobilisationDate: project.mobilisationDate!,
            pendingWorkers: workers,
          });
          emailsSent++;
        } catch {
          console.error(`[mob-reminder] Email failed for ${admin.email}`);
        }
      }
    }
  }

  console.log(
    `[mob-reminder] projectsChecked=${projects.length} smsSent=${smsSent} emailsSent=${emailsSent}`,
  );

  return NextResponse.json({
    ok: true,
    projectsChecked: projects.length,
    smsSent,
    emailsSent,
  });
}
