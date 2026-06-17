import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendQuarterlyRetentionReportEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

// Quarterly: email Directors a data retention activity report for the quarter
// just ended (Sprint S4 §F).
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Previous quarter window.
  const now = new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const startMonth = currentQuarter * 3 - 3;
  const start = new Date(now.getFullYear(), startMonth, 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), startMonth + 3, 1, 0, 0, 0, 0);
  const range = { gte: start, lt: end };

  const [anonymised, dismissed, pendingRequests] = await Promise.all([
    prisma.dataRetentionLog.count({ where: { action: "ANONYMISED", occurredAt: range } }),
    prisma.dataRetentionLog.count({ where: { action: "DISMISSED", occurredAt: range } }),
    prisma.dataDeletionRequest.count({ where: { status: "PENDING" } }),
  ]);

  const periodLabel = `${start.toLocaleDateString("en-AU")} – ${new Date(end.getTime() - 1).toLocaleDateString("en-AU")}`;

  const directors = await prisma.user.findMany({
    where: { role: "admin" },
    select: { email: true, name: true },
  });

  const reviewUrl = `${getAppUrl()}/admin/retention`;
  let emailsSent = 0;
  for (const d of directors) {
    try {
      await sendQuarterlyRetentionReportEmail({
        to: d.email,
        adminName: d.name,
        periodLabel,
        anonymised,
        dismissed,
        pendingRequests,
        reviewUrl,
      });
      emailsSent++;
    } catch {
      console.error(`[retention-report] email failed for ${d.email}`);
    }
  }

  return NextResponse.json({ ok: true, periodLabel, anonymised, dismissed, pendingRequests, emailsSent });
}
