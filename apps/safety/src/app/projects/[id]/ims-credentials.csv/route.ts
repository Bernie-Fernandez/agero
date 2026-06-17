import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { daysUntil } from "@/lib/s3-registers";

const CREDENTIAL_LABELS: Record<string, string> = {
  WHITE_CARD: "White Card",
  HRWL_SCAFFOLD: "HRWL — Scaffolding",
  HRWL_CRANE: "HRWL — Crane",
  HRWL_FORKLIFT: "HRWL — Forklift",
  HRWL_EWP: "HRWL — EWP",
  HRWL_DOGGING: "HRWL — Dogging",
  HRWL_RIGGING: "HRWL — Rigging",
  HRWL_CONFINED_SPACE: "HRWL — Confined Space",
  HRWL_EXPLOSIVE: "HRWL — Explosive",
  HRWL_OTHER: "HRWL — Other",
  TRADE_CERTIFICATE: "Trade Certificate",
  FIRST_AID: "First Aid",
  ASBESTOS_AWARENESS: "Asbestos Awareness",
  DRIVER_LICENCE: "Driver Licence",
  PASSPORT: "Passport",
  GOVERNMENT_ID: "Government ID",
  TRAINING_CERTIFICATE: "Training Certificate",
  OTHER: "Other",
};

function credentialStatus(expiry: Date | null, verified: boolean): string {
  if (expiry) {
    const d = daysUntil(expiry);
    if (d < 0) return "Expired";
    if (d <= 30) return "Expiring";
  }
  return verified ? "Verified" : "Current";
}

function csvCell(v: unknown): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

// IMS Training Bridge — ISO 45001 Clause 7.2 competence evidence.
// Exports every worker credential on the project. Director-only.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const appUser = await requireRole(["admin"]);

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id },
    select: { id: true, name: true, organisationId: true, erpProjectId: true },
  });
  if (!safetyProject || safetyProject.organisationId !== appUser.organisationId) {
    return new NextResponse("Not found", { status: 404 });
  }

  const workers = await prisma.worker.findMany({
    where: { projectId: safetyProject.erpProjectId },
    include: {
      employingOrganisation: { select: { name: true } },
      credentials: { orderBy: { credentialType: "asc" } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const fmtDate = (d: Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString("en-AU", { timeZone: "Australia/Melbourne" }) : "";

  const rows: string[] = [
    "Worker,Company,Credential Type,Number,Issue Date,Expiry Date,Status",
  ];

  for (const w of workers) {
    const company = w.employingOrganisation?.name ?? "";
    if (w.credentials.length === 0) {
      rows.push(
        [`${w.firstName} ${w.lastName}`, company, "No credentials recorded", "", "", "", "—"]
          .map(csvCell)
          .join(","),
      );
      continue;
    }
    for (const c of w.credentials) {
      rows.push(
        [
          `${w.firstName} ${w.lastName}`,
          company,
          CREDENTIAL_LABELS[c.credentialType] ?? c.credentialType,
          c.credentialNumber ?? "",
          fmtDate(c.issueDate),
          fmtDate(c.expiryDate),
          credentialStatus(c.expiryDate, c.isVerified),
        ]
          .map(csvCell)
          .join(","),
      );
    }
  }

  const dateTag = new Date().toLocaleDateString("en-AU").replace(/\//g, "-");
  const filename = `ims-credentials-${safetyProject.name.replace(/[^a-z0-9]/gi, "-")}-${dateTag}.csv`;

  return new NextResponse(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
