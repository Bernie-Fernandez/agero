import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, AGERO_ROLES } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const appUser = await requireRole(AGERO_ROLES);

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true, organisationId: true },
  });
  if (!project || project.organisationId !== appUser.organisationId) {
    return new NextResponse("Not found", { status: 404 });
  }

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { erpProjectId: id },
    select: { id: true },
  });

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [visits, visitors] = await Promise.all([
    prisma.siteVisit.findMany({
      where: { projectId: id, signedInAt: { gte: todayStart, lt: todayEnd } },
      include: {
        worker: {
          include: {
            employingOrganisation: { select: { name: true } },
            credentials: {
              where: { credentialType: "FIRST_AID" },
              select: { id: true },
            },
          },
        },
      },
      orderBy: { signedInAt: "asc" },
    }),
    safetyProject
      ? prisma.visitorSignIn.findMany({
          where: {
            projectId: safetyProject.id,
            acknowledgedAt: { gte: todayStart, lt: todayEnd },
          },
          orderBy: { acknowledgedAt: "asc" },
        })
      : [],
  ]);

  const fmt = (d: Date | null | undefined) =>
    d
      ? d.toLocaleTimeString("en-AU", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Australia/Melbourne",
        })
      : "";

  const rows: string[] = [
    "Type,Name,Company,Trade,First Aider,Sign In,Sign Out,Hours",
  ];

  for (const v of visits) {
    const end = v.signedOutAt ?? now;
    const hrs = ((end.getTime() - v.signedInAt.getTime()) / (1000 * 60 * 60)).toFixed(2);
    rows.push(
      [
        "Worker",
        `${v.worker.firstName} ${v.worker.lastName}`,
        v.worker.employingOrganisation?.name ?? "",
        v.worker.trade ?? "",
        v.worker.credentials.length > 0 ? "Yes" : "No",
        fmt(v.signedInAt),
        fmt(v.signedOutAt),
        hrs,
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(","),
    );
  }

  for (const v of visitors) {
    rows.push(
      [
        "Visitor",
        v.visitorName,
        v.company ?? "",
        v.purpose ?? "",
        "N/A",
        fmt(v.acknowledgedAt),
        fmt(v.signedOutAt),
        "",
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(","),
    );
  }

  const dateTag = now.toLocaleDateString("en-AU").replace(/\//g, "-");
  const filename = `attendance-${project.name.replace(/[^a-z0-9]/gi, "-")}-${dateTag}.csv`;

  return new NextResponse(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
