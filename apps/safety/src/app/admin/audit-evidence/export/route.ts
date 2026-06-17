import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_MANAGER_ROLES } from "@/lib/auth";
import { buildAuditEvidence } from "@/lib/audit-evidence";
import { generateAuditEvidencePdf } from "@/lib/pdf/audit-evidence-pdf";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await requireRole(ADMIN_MANAGER_ROLES);

  const fromStr = req.nextUrl.searchParams.get("from");
  const toStr = req.nextUrl.searchParams.get("to");
  if (!fromStr || !toStr) return new NextResponse("Missing date range", { status: 400 });

  const from = new Date(fromStr);
  const to = new Date(toStr);
  to.setHours(23, 59, 59, 999);

  const org = await prisma.organisation.findUnique({
    where: { id: user.organisationId },
    select: { name: true },
  });

  const { sections, consultationEvents } = await buildAuditEvidence(user.organisationId, from, to);

  const pdf = await generateAuditEvidencePdf({
    orgName: org?.name ?? "Agero Group",
    fromLabel: from.toLocaleDateString("en-AU"),
    toLabel: new Date(toStr).toLocaleDateString("en-AU"),
    generatedBy: user.name ?? user.email,
    sections,
    consultationEvents,
  });

  const filename = `iso45001-audit-evidence-${fromStr}-to-${toStr}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
