'use server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import { createStorageAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import Anthropic from '@anthropic-ai/sdk';

// ─── Document Register ────────────────────────────────────────────────────────

export async function addDocument(estimateId: string, formData: FormData) {
  const user = await requireAppUser();
  const discipline = formData.get('discipline') as string;
  const documentRef = formData.get('documentRef') as string;
  const documentTitle = formData.get('documentTitle') as string;
  const revision = formData.get('revision') as string;
  const issuedBy = (formData.get('issuedBy') as string) || null;
  const issueDateStr = formData.get('issueDate') as string;
  const issueDate = issueDateStr ? new Date(issueDateStr) : null;

  const doc = await prisma.estimateDocumentRegister.create({
    data: {
      estimateId,
      discipline,
      documentRef,
      documentTitle,
      revision,
      issueDate,
      issuedBy,
      uploadedById: user.id,
    },
  });

  // If PDF file was uploaded
  const pdfFile = formData.get('pdf') as File | null;
  if (pdfFile && pdfFile.size > 0) {
    const storage = createStorageAdminClient();
    const bytes = await pdfFile.arrayBuffer();
    const path = `${estimateId}/${doc.id}/${pdfFile.name}`;
    await storage.from('estimate-drawings').upload(path, bytes, {
      contentType: 'application/pdf',
      upsert: true,
    });

    const { data: signedData } = await storage
      .from('estimate-drawings')
      .createSignedUrl(path, 60 * 60 * 24 * 365);

    await prisma.estimateDocumentRegister.update({
      where: { id: doc.id },
      data: {
        storageUrl: path,
        uploadSizeBytes: pdfFile.size,
        uploadedAt: new Date(),
      },
    });

    // Trigger drawing intelligence scan in background
    triggerDrawingIntelligenceScan(doc.id, estimateId, path, pdfFile.name).catch(console.error);
  }

  revalidatePath(`/leads/${estimateId}/documents`);
}

export async function getSignedUrl(storagePath: string): Promise<string | null> {
  try {
    const storage = createStorageAdminClient();
    const { data } = await storage
      .from('estimate-drawings')
      .createSignedUrl(storagePath, 3600);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

export async function markSuperseded(documentId: string, estimateId: string) {
  await requireAppUser();
  await prisma.estimateDocumentRegister.update({
    where: { id: documentId },
    data: { status: 'superseded' },
  });
  revalidatePath(`/leads/${estimateId}/documents`);
}

export async function markPricedAgainst(documentId: string, estimateId: string, discipline: string) {
  await requireAppUser();
  await prisma.$transaction([
    prisma.estimateDocumentRegister.updateMany({
      where: { estimateId, discipline },
      data: { pricedAgainst: false },
    }),
    prisma.estimateDocumentRegister.update({
      where: { id: documentId },
      data: { pricedAgainst: true },
    }),
  ]);
  revalidatePath(`/leads/${estimateId}/documents`);
}

// ─── Drawing Convention ───────────────────────────────────────────────────────

export async function saveDrawingConvention(estimateId: string, formData: FormData) {
  await requireAppUser();
  const data = {
    spaceReferenceStyle: formData.get('spaceReferenceStyle') as string,
    revisionFormat: (formData.get('revisionFormat') as string) || null,
    drawingNumberFormat: (formData.get('drawingNumberFormat') as string) || null,
    architectFirm: (formData.get('architectFirm') as string) || null,
    notes: (formData.get('notes') as string) || null,
  };
  await prisma.estimateDrawingConvention.upsert({
    where: { estimateId },
    create: { estimateId, ...data },
    update: data,
  });
  revalidatePath(`/leads/${estimateId}/documents`);
}

// ─── Element Code Library ─────────────────────────────────────────────────────

export async function addElementCode(estimateId: string, formData: FormData) {
  await requireAppUser();
  await prisma.estimateElementCode.create({
    data: {
      estimateId,
      code: formData.get('code') as string,
      category: formData.get('category') as string,
      name: formData.get('name') as string,
      description: (formData.get('description') as string) || null,
      supplier: (formData.get('supplier') as string) || null,
      locationNotes: (formData.get('locationNotes') as string) || null,
      leadTime: (formData.get('leadTime') as string) || null,
    },
  });
  revalidatePath(`/leads/${estimateId}/documents`);
}

export async function importElementCodesFromCsv(estimateId: string, formData: FormData) {
  await requireAppUser();
  const csvFile = formData.get('csv') as File;
  const text = await csvFile.text();
  const lines = text.split('\n').filter(Boolean);
  if (lines.length < 2) return;

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z_]/g, ''));

  const getCol = (row: string[], colNames: string[]): string => {
    for (const name of colNames) {
      const idx = headers.indexOf(name);
      if (idx >= 0) return (row[idx] ?? '').trim();
    }
    return '';
  };

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    const code = getCol(row, ['code']);
    const category = getCol(row, ['category']);
    const name = getCol(row, ['name']);
    if (!code || !name) continue;
    records.push({
      estimateId,
      code,
      category: category || 'Other',
      name,
      description: getCol(row, ['description']) || null,
      supplier: getCol(row, ['supplier']) || null,
      locationNotes: getCol(row, ['location_notes', 'location']) || null,
      leadTime: getCol(row, ['lead_time', 'leadtime']) || null,
    });
  }

  if (records.length > 0) {
    await prisma.estimateElementCode.createMany({ data: records, skipDuplicates: true });
  }
  revalidatePath(`/leads/${estimateId}/documents`);
}

// ─── Drawing Intelligence Scan ────────────────────────────────────────────────

async function triggerDrawingIntelligenceScan(
  documentId: string,
  estimateId: string,
  storagePath: string,
  filename: string
) {
  const report = await prisma.drawingIntelligenceReport.create({
    data: { estimateId, documentId, scanStatus: 'pending' },
  });

  try {
    const storage = createStorageAdminClient();
    const { data: signedData } = await storage
      .from('estimate-drawings')
      .createSignedUrl(storagePath, 3600);

    if (!signedData?.signedUrl) throw new Error('Could not get signed URL');

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are reviewing a set of architectural/construction drawings uploaded to an estimating system.
The PDF file is named: "${filename}"

Analyse the drawings and respond with a JSON object with these exact fields:
{
  "page_count": <number or null>,
  "disciplines_detected": <array of strings from: ["Architectural","Structural","Mechanical","Electrical","Hydraulic","Fire","FF&E Schedule","Finishes Schedule","Lighting Schedule","Specification"]>,
  "mixed_revisions_detected": <boolean>,
  "draft_status_detected": <boolean>,
  "scale_issues_detected": <boolean>,
  "revision_notes": <string description of any revision issues>,
  "missing_disciplines": <array of discipline strings not detected>,
  "ceiling_heights_noted": <boolean>,
  "schedules_referenced_but_missing": <array of schedule type strings>
}

If you cannot access the actual PDF content, base your response on the filename and return reasonable defaults with null for uncertain fields.`,
            },
            {
              type: 'document',
              source: { type: 'url', url: signedData.signedUrl },
            } as { type: 'document'; source: { type: 'url'; url: string } },
          ],
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');

    let parsed: {
      page_count?: number;
      disciplines_detected?: string[];
      mixed_revisions_detected?: boolean;
      draft_status_detected?: boolean;
      scale_issues_detected?: boolean;
      revision_notes?: string;
      missing_disciplines?: string[];
      ceiling_heights_noted?: boolean;
      schedules_referenced_but_missing?: string[];
    } = {};
    try {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      // Use defaults
    }

    const disciplines = parsed.disciplines_detected ?? [];
    const missingDisciplines = parsed.missing_disciplines ?? [];
    const mixedRevisions = parsed.mixed_revisions_detected ?? false;
    const draftStatus = parsed.draft_status_detected ?? false;
    const scaleIssues = parsed.scale_issues_detected ?? false;
    const ceilingHeightsNoted = parsed.ceiling_heights_noted ?? true;
    const missingSchedules = parsed.schedules_referenced_but_missing ?? [];

    await prisma.drawingIntelligenceReport.update({
      where: { id: report.id },
      data: {
        scanStatus: 'complete',
        pageCount: parsed.page_count ?? null,
        disciplinesDetected: disciplines,
        mixedRevisionsDetected: mixedRevisions,
        draftStatusDetected: draftStatus,
        scaleIssuesDetected: scaleIssues,
        scannedAt: new Date(),
      },
    });

    // Generate questions
    const questions: { layer: string; questionText: string; isMandatory: boolean; sortOrder: number }[] = [];
    let sortOrder = 0;

    // Layer 1 — missing disciplines
    for (const discipline of missingDisciplines) {
      questions.push({
        layer: 'discipline_completeness',
        questionText: `${discipline} drawings are not in this set. Is ${discipline} work: (a) In scope but drawings not yet issued, (b) Excluded from this contract, (c) By others / separate contract, (d) Design & Construct by contractor, (e) Not applicable to this project`,
        isMandatory: true,
        sortOrder: sortOrder++,
      });
    }

    // Layer 2 — title block issues
    if (mixedRevisions && parsed.revision_notes) {
      questions.push({
        layer: 'title_block',
        questionText: `Mixed revision dates detected across the drawing set. ${parsed.revision_notes}. Confirm all sheets are the current issued set.`,
        isMandatory: true,
        sortOrder: sortOrder++,
      });
    }
    if (draftStatus) {
      questions.push({
        layer: 'title_block',
        questionText: `One or more sheets show DRAFT or FOR INFORMATION status. Is this the correct issue for pricing?`,
        isMandatory: true,
        sortOrder: sortOrder++,
      });
    }
    if (scaleIssues) {
      questions.push({
        layer: 'title_block',
        questionText: `Scale is not stated or is ambiguous on some sheets. What scale applies to these drawings?`,
        isMandatory: true,
        sortOrder: sortOrder++,
      });
    }

    // Layer 3 — spatial gaps
    if (!ceilingHeightsNoted) {
      questions.push({
        layer: 'spatial',
        questionText: `Ceiling heights are not noted on these drawings. What is the typical ceiling height for this project?`,
        isMandatory: true,
        sortOrder: sortOrder++,
      });
    }
    for (const schedule of missingSchedules) {
      questions.push({
        layer: 'spatial',
        questionText: `A ${schedule} schedule is referenced in the drawing notes but has not been uploaded. Is a ${schedule} schedule applicable?`,
        isMandatory: false,
        sortOrder: sortOrder++,
      });
    }

    // Universal question
    questions.push({
      layer: 'spatial',
      questionText: `Have you visited the site or have current site knowledge that may affect the estimate?`,
      isMandatory: true,
      sortOrder: sortOrder++,
    });

    if (questions.length > 0) {
      await prisma.drawingIntelligenceQuestion.createMany({
        data: questions.map((q) => ({ ...q, reportId: report.id })),
      });
    } else {
      // No questions — auto-complete
      await prisma.drawingIntelligenceReport.update({
        where: { id: report.id },
        data: { questionnaireCompleted: true },
      });
    }
  } catch (err) {
    console.error('Drawing intelligence scan failed:', err);
    await prisma.drawingIntelligenceReport.update({
      where: { id: report.id },
      data: { scanStatus: 'failed' },
    });
  }
}

export async function submitQuestionnaireAnswers(
  reportId: string,
  estimateId: string,
  answers: { questionId: string; answerText: string }[]
) {
  const user = await requireAppUser();
  await prisma.$transaction([
    ...answers.map((a) =>
      prisma.drawingIntelligenceAnswer.upsert({
        where: { questionId: a.questionId },
        create: {
          questionId: a.questionId,
          answerText: a.answerText,
          answeredById: user.id,
        },
        update: {
          answerText: a.answerText,
          answeredById: user.id,
          answeredAt: new Date(),
        },
      })
    ),
    prisma.drawingIntelligenceReport.update({
      where: { id: reportId },
      data: { questionnaireCompleted: true },
    }),
  ]);
  revalidatePath(`/leads/${estimateId}/documents`);
}
