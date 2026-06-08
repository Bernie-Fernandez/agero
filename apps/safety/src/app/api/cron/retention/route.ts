import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendRetentionReviewEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

function maskMobile(mobile: string): string {
  if (mobile.length <= 7) return "*".repeat(mobile.length);
  return mobile.slice(0, 4) + "*".repeat(mobile.length - 7) + mobile.slice(-3);
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  // Find workers inactive for 2+ years with no existing unresolved flag
  const inactiveWorkers = await prisma.workerAccount.findMany({
    where: {
      AND: [
        {
          OR: [
            { lastActiveAt: { lt: twoYearsAgo } },
            { lastActiveAt: null, createdAt: { lt: twoYearsAgo } },
          ],
        },
        { retentionFlags: { none: { resolution: null } } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      mobile: true,
      lastActiveAt: true,
      createdAt: true,
    },
  });

  if (inactiveWorkers.length === 0) {
    console.log("[retention] No new workers to flag");
    return NextResponse.json({ ok: true, flagged: 0, emailsSent: 0 });
  }

  // Create retention flags
  await prisma.retentionFlag.createMany({
    data: inactiveWorkers.map((w) => ({ workerAccountId: w.id })),
  });

  // Email all Directors (admin role)
  const directors = await prisma.user.findMany({
    where: { role: "admin" },
    select: { email: true, name: true },
  });

  const host = getAppUrl();
  const reviewUrl = `${host}/admin/retention`;

  const flaggedWorkers = inactiveWorkers.map((w) => ({
    name: `${w.firstName} ${w.lastName}`,
    maskedMobile: maskMobile(w.mobile),
    lastActiveLabel: w.lastActiveAt
      ? w.lastActiveAt.toLocaleDateString("en-AU")
      : `Never (registered ${w.createdAt.toLocaleDateString("en-AU")})`,
  }));

  let emailsSent = 0;
  for (const director of directors) {
    try {
      await sendRetentionReviewEmail({
        to: director.email,
        adminName: director.name,
        flaggedWorkers,
        reviewUrl,
      });
      emailsSent++;
    } catch {
      console.error(`[retention] Email failed for ${director.email}`);
    }
  }

  console.log(`[retention] flagged=${inactiveWorkers.length} emailsSent=${emailsSent}`);

  return NextResponse.json({ ok: true, flagged: inactiveWorkers.length, emailsSent });
}
