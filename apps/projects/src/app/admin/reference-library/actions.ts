'use server';
import { prisma } from '@/lib/prisma';
import { requireDirector } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function updateReferenceItem(
  id: string,
  data: { displayName?: string; unit?: string; natspecRef?: string; asRef?: string; isActive?: boolean }
) {
  await requireDirector();
  await prisma.referenceLibraryItem.update({ where: { id }, data: { ...data, updatedAt: new Date() } });
  revalidatePath('/admin/reference-library');
}

export async function createReferenceItem(formData: FormData) {
  const user = await requireDirector();
  const ageroRef = formData.get('ageroRef') as string;
  const displayName = formData.get('displayName') as string;
  const tradeSectionCode = formData.get('tradeSectionCode') as string;
  const unit = formData.get('unit') as string;
  const bluebeamToolType = formData.get('bluebeamToolType') as string;
  const natspecRef = (formData.get('natspecRef') as string) || null;
  const asRef = (formData.get('asRef') as string) || null;

  const TRADE_COLOURS: Record<string, string> = {
    DE: '#FF0000', PA: '#4472C4', FL: '#70AD47', ED: '#FFC000',
    PT: '#ED7D31', ME: '#7030A0', PH: '#FFFFFF', FI: '#FF6600',
    JO: '#5C3317', FU: '#333333', SI: '#000000', CP: '#92D050',
  };

  await prisma.referenceLibraryItem.create({
    data: {
      organisationId: user.organisationId,
      ageroRef,
      displayName,
      tradeSectionCode,
      tradeGroupColour: TRADE_COLOURS[tradeSectionCode] ?? '#6366f1',
      unit,
      bluebeamToolType,
      natspecRef,
      asRef,
    },
  });
  revalidatePath('/admin/reference-library');
}

export async function generateBluebeamTemplate(organisationId: string): Promise<string> {
  await requireDirector();
  const items = await prisma.referenceLibraryItem.findMany({
    where: { organisationId, isActive: true },
    orderBy: [{ tradeSectionCode: 'asc' }, { sortOrder: 'asc' }],
  });

  const toolTypeMap: Record<string, string> = {
    polygon: 'Area',
    polyline: 'Length',
    count: 'Count',
    rectangle: 'Area',
  };

  const toolXml = items.map((item, idx) => `  <Tool
    id="${idx + 1}"
    subject="${item.ageroRef}"
    label="${item.displayName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"
    toolType="${toolTypeMap[item.bluebeamToolType] ?? 'Count'}"
    layer="${item.tradeSectionCode}"
    color="${item.tradeGroupColour}"
    lineWidth="1"
  />`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<BluebeamToolChest version="1.0">
  <ToolSet name="Agero Reference Library" description="Agero standard measurement tools — ${new Date().toLocaleDateString('en-AU')}">
${toolXml}
  </ToolSet>
</BluebeamToolChest>`;
}
