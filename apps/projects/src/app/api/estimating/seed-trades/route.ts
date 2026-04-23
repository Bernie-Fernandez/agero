import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

const TRADE_SECTIONS = [
  { code: '01', name: 'Preliminaries & General Conditions', order: 1 },
  { code: '02', name: 'Demolition & Strip-Out', order: 2 },
  { code: '03', name: 'Structural & Concrete Works', order: 3 },
  { code: '04', name: 'Masonry & Blockwork', order: 4 },
  { code: '05', name: 'Steel & Metalwork', order: 5 },
  { code: '06', name: 'Carpentry & Joinery', order: 6 },
  { code: '07', name: 'Waterproofing & Tanking', order: 7 },
  { code: '08', name: 'Roofing & Cladding', order: 8 },
  { code: '09', name: 'Windows, Glazing & Curtain Wall', order: 9 },
  { code: '10', name: 'Doors & Hardware', order: 10 },
  { code: '11', name: 'Internal Partitions & Framing', order: 11 },
  { code: '12', name: 'Ceilings & Soffits', order: 12 },
  { code: '13', name: 'Flooring & Floor Finishes', order: 13 },
  { code: '14', name: 'Wall Finishes & Linings', order: 14 },
  { code: '15', name: 'Painting & Decorating', order: 15 },
  { code: '16', name: 'Hydraulics & Plumbing', order: 16 },
  { code: '17', name: 'Mechanical & HVAC', order: 17 },
  { code: '18', name: 'Electrical & Data', order: 18 },
  { code: '19', name: 'Fire Protection & Sprinklers', order: 19 },
  { code: '20', name: 'Lifts & Vertical Transport', order: 20 },
  { code: '21', name: 'Furniture, Fixtures & Equipment', order: 21 },
  { code: '22', name: 'Landscaping & External Works', order: 22 },
  { code: '23', name: 'Statutory & Authority Fees', order: 23 },
  { code: '24', name: 'Contingency & Provisional Sums', order: 24 },
];

const TRADE_PACKAGE_TEMPLATES = [
  { sectionCode: '02', name: 'Full Strip-Out Package' },
  { sectionCode: '02', name: 'Selective Demolition' },
  { sectionCode: '03', name: 'Concrete Slab & Footing' },
  { sectionCode: '06', name: 'Millwork & Custom Joinery' },
  { sectionCode: '11', name: 'Metal Stud & Plasterboard' },
  { sectionCode: '12', name: 'Suspended Ceiling Grid' },
  { sectionCode: '13', name: 'Carpet & Resilient Flooring' },
  { sectionCode: '13', name: 'Tile & Stone Flooring' },
  { sectionCode: '14', name: 'Plasterboard & Render' },
  { sectionCode: '15', name: 'Full Paint Package' },
  { sectionCode: '16', name: 'Hydraulics Package' },
  { sectionCode: '17', name: 'HVAC Supply & Install' },
  { sectionCode: '17', name: 'BMS & Controls' },
  { sectionCode: '18', name: 'Electrical Fitout' },
  { sectionCode: '18', name: 'Data & Communications' },
  { sectionCode: '18', name: 'AV & Security' },
  { sectionCode: '19', name: 'Sprinkler Extension & Modifications' },
  { sectionCode: '21', name: 'FF&E Supply & Install' },
];

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (user.role !== 'DIRECTOR' && user.role !== 'ADMINISTRATOR') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const ORG_ID = user.organisationId;
  let sectionsCreated = 0;
  let packagesCreated = 0;

  // Seed trade sections (org-level, no estimateId)
  for (const section of TRADE_SECTIONS) {
    const existing = await prisma.estimateTradeSection.findFirst({
      where: { organisationId: ORG_ID, code: section.code, estimateId: null },
    });
    if (!existing) {
      await prisma.estimateTradeSection.create({
        data: { organisationId: ORG_ID, name: section.name, code: section.code, order: section.order },
      });
      sectionsCreated++;
    }
  }

  // Seed trade package templates as scope library items
  for (const pkg of TRADE_PACKAGE_TEMPLATES) {
    const section = await prisma.estimateTradeSection.findFirst({
      where: { organisationId: ORG_ID, code: pkg.sectionCode, estimateId: null },
    });
    if (section) {
      const existing = await prisma.scopeLibraryItem.findFirst({
        where: { organisationId: ORG_ID, tradeSectionId: section.id, description: pkg.name },
      });
      if (!existing) {
        await prisma.scopeLibraryItem.create({
          data: {
            organisationId: ORG_ID,
            tradeSectionId: section.id,
            description: pkg.name,
            isGlobal: true,
          },
        });
        packagesCreated++;
      }
    }
  }

  return NextResponse.json({ ok: true, sectionsCreated, packagesCreated });
}
