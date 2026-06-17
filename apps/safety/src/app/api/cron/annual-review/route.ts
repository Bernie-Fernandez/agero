import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAnnualReviewDueEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

// Nightly: flag WHS document templates whose review is due within 30 days and
// notify Directors (Sprint S4 §5 task 4).
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 30);

  const dueTemplates = await prisma.wHSDocumentTemplate.findMany({
    where: { nextReviewDate: { lte: horizon } },
    orderBy: { nextReviewDate: "asc" },
    select: { id: true, name: true, nextReviewDate: true, organisationId: true, flaggedForReview: true },
  });

  if (dueTemplates.length === 0) {
    return NextResponse.json({ ok: true, due: 0, emailsSent: 0 });
  }

  // Flag the due templates (idempotent) so the review page surfaces them.
  await prisma.wHSDocumentTemplate.updateMany({
    where: { id: { in: dueTemplates.map((t) => t.id) }, flaggedForReview: false },
    data: { flaggedForReview: true, flaggedReason: "Scheduled annual review due" },
  });

  // Group due templates by organisation, then email that org's Directors.
  const byOrg = new Map<string, typeof dueTemplates>();
  for (const t of dueTemplates) {
    const arr = byOrg.get(t.organisationId) ?? [];
    arr.push(t);
    byOrg.set(t.organisationId, arr);
  }

  const reviewUrl = `${getAppUrl()}/admin/annual-review`;
  let emailsSent = 0;

  for (const [organisationId, templates] of byOrg) {
    const directors = await prisma.user.findMany({
      where: { organisationId, role: { in: ["admin", "safety_manager"] } },
      select: { email: true, name: true },
    });
    const payload = templates.map((t) => ({
      name: t.name,
      nextReviewDate: t.nextReviewDate.toLocaleDateString("en-AU"),
      daysUntil: Math.ceil((t.nextReviewDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    }));
    for (const d of directors) {
      try {
        await sendAnnualReviewDueEmail({ to: d.email, adminName: d.name, dueTemplates: payload, reviewUrl });
        emailsSent++;
      } catch {
        console.error(`[annual-review] email failed for ${d.email}`);
      }
    }
  }

  return NextResponse.json({ ok: true, due: dueTemplates.length, emailsSent });
}
