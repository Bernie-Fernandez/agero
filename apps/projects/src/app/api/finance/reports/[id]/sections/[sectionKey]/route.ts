import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sectionKey: string }> }
) {
  const { id, sectionKey } = await params;
  const user = await requireAppUser();
  if (user.role !== 'DIRECTOR') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const report = await prisma.managementReport.findFirst({
    where: { id, organisationId: user.organisationId },
  });
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (report.status === 'FINAL') return NextResponse.json({ error: 'Cannot edit a FINAL report' }, { status: 400 });

  const { editedContent } = await req.json();

  const section = await prisma.managementReportSection.upsert({
    where: { managementReportId_sectionKey: { managementReportId: id, sectionKey } },
    create: {
      managementReportId: id,
      sectionKey,
      editedContent,
      lastEditedAt: new Date(),
      lastEditedById: user.id,
    },
    update: {
      editedContent,
      lastEditedAt: new Date(),
      lastEditedById: user.id,
    },
  });

  return NextResponse.json(JSON.parse(JSON.stringify(section)));
}
