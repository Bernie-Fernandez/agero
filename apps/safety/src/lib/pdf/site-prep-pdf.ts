// pdfmake 0.3.x — see src/types/pdfmake.d.ts for the shim.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DocDef = Record<string, any>;

export interface SectionResult {
  sectionId: string;
  sectionName: string;
  answer: "YES" | "NO" | "NA";
  note?: string;
  photoUrl?: string;
}

export interface PlanSection {
  sectionId: string;
  sectionName: string;
  planNote: string;
  plannedCompletionDate: string;
}

export interface SitePrepPdfData {
  projectName: string;
  projectAddress: string | null;
  completionDate: string;
  sections: SectionResult[];
  planSections?: PlanSection[];
  managerSignOffName: string;
  managerSignOffAt: Date;
  signatureUrl?: string;
}

const GREY = "#f4f4f5";
const DARK = "#18181b";
const RED = "#dc2626";
const GREEN = "#16a34a";
const AMBER = "#d97706";

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${ct};base64,${base64}`;
  } catch {
    return null;
  }
}

function answerColor(answer: string): string {
  if (answer === "YES") return GREEN;
  if (answer === "NO") return RED;
  return "#71717a";
}

export async function generateSitePrepPdf(data: SitePrepPdfData): Promise<Buffer> {
  const { default: PdfPrinter } = await import("pdfmake");

  const fonts = {
    Helvetica: {
      normal: "Helvetica",
      bold: "Helvetica-Bold",
      italics: "Helvetica-Oblique",
      bolditalics: "Helvetica-BoldOblique",
    },
  };

  const noSections = data.sections.filter((s) => s.answer === "NO");
  const yesCount = data.sections.filter((s) => s.answer === "YES").length;
  const noCount = noSections.length;
  const naCount = data.sections.filter((s) => s.answer === "NA").length;

  // Pre-fetch non-compliant section photos
  const photoDataMap = new Map<string, string | null>();
  await Promise.all(
    noSections
      .filter((s) => s.photoUrl)
      .map(async (s) => {
        const dataUrl = await fetchImageAsDataUrl(s.photoUrl!);
        photoDataMap.set(s.sectionId, dataUrl);
      }),
  );

  // Optionally fetch signature
  let signatureDataUrl: string | null = null;
  if (data.signatureUrl) {
    signatureDataUrl = await fetchImageAsDataUrl(data.signatureUrl);
  }

  // Build a planNote lookup map
  const planNoteMap = new Map<string, string>();
  for (const ps of data.planSections ?? []) {
    planNoteMap.set(ps.sectionId, ps.planNote);
  }

  // ── Phase 1 planning notes section ──────────────────────────────────────────
  const phase1Section: DocDef[] = [];
  if (data.planSections && data.planSections.length > 0) {
    phase1Section.push({ text: "Phase 1 — Site Preparation Plan", style: "h2" });
    phase1Section.push({
      table: {
        headerRows: 1,
        widths: [130, "*", 70],
        body: [
          [
            { text: "Category", style: "tableHeader", margin: [4, 3, 4, 3] },
            { text: "Planned setup", style: "tableHeader", margin: [4, 3, 4, 3] },
            { text: "Target date", style: "tableHeader", margin: [4, 3, 4, 3] },
          ],
          ...data.planSections.map((ps) => [
            { text: ps.sectionName, style: "tableCell", bold: true, margin: [4, 2, 4, 2] },
            { text: ps.planNote, style: "tableCell", margin: [4, 2, 4, 2] },
            {
              text: new Date(ps.plannedCompletionDate).toLocaleDateString("en-AU", {
                day: "numeric",
                month: "short",
                year: "numeric",
              }),
              style: "tableCell",
              margin: [4, 2, 4, 2],
            },
          ]),
        ],
      },
      layout: {
        hLineColor: () => "#e4e4e7",
        vLineColor: () => "#e4e4e7",
        fillColor: (ri: number) => (ri === 0 ? GREY : ri % 2 === 0 ? "#fafafa" : null),
      },
      margin: [0, 0, 0, 16],
    });
  }

  // ── Phase 2 inspection results section ──────────────────────────────────────
  const inspectionTable: DocDef = {
    table: {
      headerRows: 1,
      widths: [130, 30, "*", 100],
      body: [
        [
          { text: "Category", style: "tableHeader", margin: [4, 3, 4, 3] },
          { text: "Result", style: "tableHeader", margin: [4, 3, 4, 3] },
          { text: "Note (if NO)", style: "tableHeader", margin: [4, 3, 4, 3] },
          { text: "Planned setup", style: "tableHeader", margin: [4, 3, 4, 3] },
        ],
        ...data.sections.map((s) => [
          { text: s.sectionName, style: "tableCell", bold: true, margin: [4, 2, 4, 2] },
          {
            text: s.answer,
            style: "tableCell",
            bold: s.answer === "NO",
            color: answerColor(s.answer),
            margin: [4, 2, 4, 2],
          },
          {
            text: s.answer === "NO" ? s.note || "—" : "—",
            style: "tableCell",
            color: s.answer === "NO" ? DARK : "#71717a",
            fontSize: 7.5,
            margin: [4, 2, 4, 2],
          },
          {
            text: planNoteMap.get(s.sectionId) ?? "—",
            style: "tableCell",
            fontSize: 7.5,
            color: "#71717a",
            italics: true,
            margin: [4, 2, 4, 2],
          },
        ]),
      ],
    },
    layout: {
      hLineColor: () => "#e4e4e7",
      vLineColor: () => "#e4e4e7",
      fillColor: (ri: number) => (ri === 0 ? GREY : ri % 2 === 0 ? "#fafafa" : null),
    },
    margin: [0, 0, 0, 12],
  };

  // ── Non-compliant sections detail ────────────────────────────────────────────
  const nonCompliantSection: DocDef[] = [];
  if (noSections.length > 0) {
    nonCompliantSection.push({ text: "Non-Compliant Sections — Detail & Evidence", style: "h2" });
    nonCompliantSection.push({
      text: "The following sections were marked NO. Corrective action required before site mobilisation.",
      style: "legal",
      margin: [0, 0, 0, 8],
    });
    for (const s of noSections) {
      const photoData = s.photoUrl ? photoDataMap.get(s.sectionId) : undefined;
      const photoCell: DocDef = photoData
        ? { image: photoData, width: 150, height: 110, margin: [0, 6, 0, 0] }
        : s.photoUrl
          ? { text: "Photo unavailable", style: "legal", margin: [0, 6, 0, 0] }
          : {};
      nonCompliantSection.push({
        table: {
          widths: ["*"],
          body: [
            [
              {
                stack: [
                  { text: s.sectionName, style: "h3", color: RED },
                  { text: `Note: ${s.note || "—"}`, style: "tableCell", margin: [0, 4, 0, 0] },
                  ...(Object.keys(photoCell).length > 0 ? [photoCell] : []),
                ],
                margin: [6, 6, 6, 6],
              },
            ],
          ],
        },
        layout: { hLineColor: () => "#fca5a5", vLineColor: () => "#fca5a5" },
        margin: [0, 0, 0, 8],
      });
    }
  }

  // ── Sign-off ─────────────────────────────────────────────────────────────────
  const signOffContent: DocDef[] = [
    { text: "Sign-off", style: "h2" },
    {
      table: {
        widths: ["*", "*"],
        body: [
          [
            {
              stack: [
                { text: "Site manager", style: "h3" },
                { text: data.managerSignOffName, fontSize: 13, bold: true, margin: [0, 4, 0, 0] },
                ...(signatureDataUrl
                  ? [{ image: signatureDataUrl, width: 120, height: 36, margin: [0, 6, 0, 0] }]
                  : []),
              ],
              margin: [6, 8, 6, 8],
            },
            {
              stack: [
                { text: "Signed off at", style: "h3" },
                {
                  text: data.managerSignOffAt.toLocaleString("en-AU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                  fontSize: 11,
                  bold: true,
                  margin: [0, 4, 0, 0],
                },
              ],
              margin: [6, 8, 6, 8],
            },
          ],
        ],
      },
      layout: { hLineColor: () => "#e4e4e7", vLineColor: () => "#e4e4e7" },
    },
    {
      text:
        noCount > 0
          ? `\n${noCount} non-compliant section${noCount !== 1 ? "s" : ""} identified. Corrective actions must be addressed and re-inspected before site mobilisation.`
          : "\nAll sections passed. Site preparation is compliant with Victorian OHS Regulations 2017.",
      style: "legal",
      color: noCount > 0 ? AMBER : GREEN,
      margin: [0, 8, 0, 0],
    },
  ];

  const docDefinition: DocDef = {
    defaultStyle: { font: "Helvetica", fontSize: 9, color: DARK },
    pageSize: "A4",
    pageMargins: [40, 50, 40, 50],
    styles: {
      h1: { fontSize: 16, bold: true, color: DARK },
      h2: { fontSize: 11, bold: true, color: DARK, margin: [0, 14, 0, 4] },
      h3: { fontSize: 9, bold: true, color: DARK, margin: [0, 4, 0, 2] },
      sub: { fontSize: 8, color: "#52525b" },
      legal: { fontSize: 7.5, color: "#71717a", italics: true },
      tableHeader: { fontSize: 8, bold: true, color: "#52525b", fillColor: GREY },
      tableCell: { fontSize: 8.5, margin: [0, 2, 0, 2] },
    },
    header: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: "Agero Group Pty Ltd", style: "sub", margin: [40, 18, 0, 0] },
        {
          text: `Site Preparation Checklist  ·  Page ${currentPage} of ${pageCount}`,
          style: "sub",
          alignment: "right",
          margin: [0, 18, 40, 0],
        },
      ],
    }),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    footer: (_page: number) => ({
      text: "Agero Safety Platform  ·  VIC OHS Regulations 2017  ·  Building Regulations 2018  ·  AS 2675",
      style: "legal",
      alignment: "center",
      margin: [40, 8, 40, 0],
    }),
    content: [
      // Title block
      { text: "Site Preparation Checklist", style: "h1", margin: [0, 0, 0, 4] },
      {
        columns: [
          {
            stack: [
              { text: `Project: ${data.projectName}`, style: "sub" },
              ...(data.projectAddress ? [{ text: data.projectAddress, style: "legal" }] : []),
            ],
          },
          {
            stack: [
              {
                text: `Inspection date: ${new Date(data.completionDate).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}`,
                style: "sub",
                alignment: "right",
              },
              {
                text: `Generated: ${data.managerSignOffAt.toLocaleString("en-AU")}`,
                style: "legal",
                alignment: "right",
              },
            ],
          },
        ],
        margin: [0, 0, 0, 6],
      },

      // Summary row
      {
        table: {
          widths: ["*", "*", "*", "*"],
          body: [
            [
              { text: "Total sections", style: "tableHeader", margin: [6, 4, 6, 4] },
              { text: "YES", style: "tableHeader", margin: [6, 4, 6, 4], color: GREEN },
              { text: "NO", style: "tableHeader", margin: [6, 4, 6, 4], color: RED },
              { text: "N/A", style: "tableHeader", margin: [6, 4, 6, 4] },
            ],
            [
              { text: String(data.sections.length), style: "tableCell", bold: true, margin: [6, 4, 6, 4] },
              { text: String(yesCount), style: "tableCell", bold: true, color: GREEN, margin: [6, 4, 6, 4] },
              { text: String(noCount), style: "tableCell", bold: true, color: noCount > 0 ? RED : DARK, margin: [6, 4, 6, 4] },
              { text: String(naCount), style: "tableCell", margin: [6, 4, 6, 4] },
            ],
          ],
        },
        layout: { hLineColor: () => "#e4e4e7", vLineColor: () => "#e4e4e7" },
        margin: [0, 0, 0, 16],
      },

      // Phase 1 planning notes
      ...phase1Section,

      // Phase 2 inspection table
      { text: "Phase 2 — Inspection Results", style: "h2" },
      inspectionTable,

      // Non-compliant detail
      ...nonCompliantSection,

      // Sign-off
      ...signOffContent,
    ],
  };

  const printer = new PdfPrinter(fonts);
  const doc = printer.createPdfKitDocument(docDefinition);
  const chunks: Buffer[] = [];

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}
