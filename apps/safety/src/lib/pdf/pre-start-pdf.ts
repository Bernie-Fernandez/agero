// pdfmake 0.3.x has no bundled types — see src/types/pdfmake.d.ts for the shim.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DocDef = Record<string, any>;

export interface HRWFlag {
  id: string;
  label: string;
  flagged: boolean;
  systemActions: string;
}

export interface PsychFlag {
  id: string;
  label: string;
  flagged: boolean;
  controls: string;
  isMoreThanTraining: boolean;
}

export interface PreStartPdfData {
  projectName: string;
  projectAddress: string | null;
  assessmentDate: string;
  highRiskFlags: HRWFlag[];
  psychosocialFlags: PsychFlag[];
  consultees: string;
  raised: string;
  decision: string;
  signOffName: string;
  signOffAt: Date;
}

const GREY = "#f4f4f5";
const DARK = "#18181b";
const RED = "#dc2626";
const GREEN = "#16a34a";
const AMBER = "#d97706";

function flagRow(item: HRWFlag): DocDef[] {
  return [
    { text: item.label, style: "tableCell" },
    {
      text: item.flagged ? "YES" : "No",
      style: "tableCell",
      bold: item.flagged,
      color: item.flagged ? RED : DARK,
    },
    {
      text: item.flagged ? item.systemActions : "—",
      style: "tableCell",
      color: item.flagged ? AMBER : "#71717a",
      fontSize: 7.5,
    },
  ];
}

function psychRow(item: PsychFlag): DocDef[] {
  return [
    { text: item.label, style: "tableCell" },
    {
      text: item.flagged ? "YES" : "No",
      style: "tableCell",
      bold: item.flagged,
      color: item.flagged ? RED : DARK,
    },
    {
      text: item.flagged ? item.controls || "No controls entered" : "—",
      style: "tableCell",
      color: item.flagged ? (item.controls ? DARK : RED) : "#71717a",
      fontSize: 7.5,
    },
  ];
}

export async function generatePreStartPdf(data: PreStartPdfData): Promise<Buffer> {
  // Dynamic import avoids issues with pdfmake's dynamic requires during Next.js build.
  const { default: PdfPrinter } = await import("pdfmake");

  const fonts = {
    Helvetica: {
      normal: "Helvetica",
      bold: "Helvetica-Bold",
      italics: "Helvetica-Oblique",
      bolditalics: "Helvetica-BoldOblique",
    },
  };

  const flaggedHRW = data.highRiskFlags.filter((f) => f.flagged);
  const flaggedPsych = data.psychosocialFlags.filter((f) => f.flagged);

  const docDefinition: DocDef = {
    defaultStyle: { font: "Helvetica", fontSize: 9, color: DARK },
    pageSize: "A4",
    pageMargins: [40, 50, 40, 50],
    styles: {
      h1: { fontSize: 16, bold: true, color: DARK },
      h2: { fontSize: 11, bold: true, color: DARK, margin: [0, 14, 0, 4] },
      h3: { fontSize: 9, bold: true, color: DARK, margin: [0, 6, 0, 2] },
      sub: { fontSize: 8, color: "#52525b" },
      legal: { fontSize: 7.5, color: "#71717a", italics: true },
      tableHeader: { fontSize: 8, bold: true, color: "#52525b", fillColor: GREY },
      tableCell: { fontSize: 8.5, margin: [0, 2, 0, 2] },
      signBox: { fontSize: 9, color: DARK },
    },
    header: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: "Agero Group Pty Ltd", style: "sub", margin: [40, 18, 0, 0] },
        {
          text: `Pre-Start Risk Assessment  ·  Page ${currentPage} of ${pageCount}`,
          style: "sub",
          alignment: "right",
          margin: [0, 18, 40, 0],
        },
      ],
    }),
    footer: (_page: number) => ({
      text: "Agero Safety Platform  ·  ISO 45001:2018  ·  Victorian OHS Regulations 2017  ·  Victorian OHS (Psychological Health) Regulations 2025",
      style: "legal",
      alignment: "center",
      margin: [40, 8, 40, 0],
    }),
    content: [
      // ── Title block ──────────────────────────────────────────────────────────
      { text: "Pre-Start Risk Assessment", style: "h1", margin: [0, 0, 0, 4] },
      {
        columns: [
          {
            stack: [
              { text: `Project: ${data.projectName}`, style: "sub" },
              ...(data.projectAddress
                ? [{ text: data.projectAddress, style: "legal" }]
                : []),
            ],
          },
          {
            stack: [
              {
                text: `Assessment date: ${new Date(data.assessmentDate).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}`,
                style: "sub",
                alignment: "right",
              },
              {
                text: `Generated: ${data.signOffAt.toLocaleString("en-AU")}`,
                style: "legal",
                alignment: "right",
              },
            ],
          },
        ],
        margin: [0, 0, 0, 6],
      },
      {
        table: {
          widths: ["*"],
          body: [[{
            text: "ISO 45001:2018 — Clause 6.1 Actions to address risks and opportunities  ·  Clause 8.1.4.2 Contractors",
            style: "legal",
            margin: [6, 4, 6, 4],
          }]],
        },
        layout: { hLineColor: () => "#e4e4e7", vLineColor: () => "#e4e4e7" },
        margin: [0, 0, 0, 16],
      },

      // ── Section 1: HRW Classifications ──────────────────────────────────────
      { text: "Part 1 — High-Risk Work Classifications", style: "h2" },
      {
        text: "Victorian OHS Regulations 2017 — Schedule 1. Manager records Yes/No for each classification.",
        style: "legal",
        margin: [0, 0, 0, 6],
      },
      {
        table: {
          headerRows: 1,
          widths: ["*", 36, "*"],
          body: [
            [
              { text: "Classification", style: "tableHeader", margin: [4, 4, 4, 4] },
              { text: "Present?", style: "tableHeader", margin: [4, 4, 4, 4] },
              { text: "Required actions", style: "tableHeader", margin: [4, 4, 4, 4] },
            ],
            ...data.highRiskFlags.map(flagRow),
          ],
        },
        layout: {
          hLineColor: () => "#e4e4e7",
          vLineColor: () => "#e4e4e7",
          fillColor: (ri: number) => (ri === 0 ? GREY : ri % 2 === 0 ? "#fafafa" : null),
        },
        margin: [0, 0, 0, 4],
      },
      flaggedHRW.length > 0
        ? {
            text: `${flaggedHRW.length} high-risk classification${flaggedHRW.length !== 1 ? "s" : ""} identified. Sub-forms required — refer to Sprint S3 register.`,
            style: "legal",
            color: AMBER,
            margin: [0, 2, 0, 0],
          }
        : { text: "No high-risk classifications identified.", style: "legal", color: GREEN },

      // ── Section 2: Psychosocial Hazards ────────────────────────────────────
      { text: "Part 2 — Psychosocial Hazard Identification", style: "h2" },
      {
        text: "Victorian OHS (Psychological Health) Regulations 2025 (effective 1 December 2025). Control measures must follow elimination hierarchy; information/training cannot be the sole control.",
        style: "legal",
        margin: [0, 0, 0, 6],
      },
      {
        table: {
          headerRows: 1,
          widths: ["*", 36, "*"],
          body: [
            [
              { text: "Hazard category", style: "tableHeader", margin: [4, 4, 4, 4] },
              { text: "Present?", style: "tableHeader", margin: [4, 4, 4, 4] },
              { text: "Control measures applied", style: "tableHeader", margin: [4, 4, 4, 4] },
            ],
            ...data.psychosocialFlags.map(psychRow),
          ],
        },
        layout: {
          hLineColor: () => "#e4e4e7",
          vLineColor: () => "#e4e4e7",
          fillColor: (ri: number) => (ri === 0 ? GREY : ri % 2 === 0 ? "#fafafa" : null),
        },
        margin: [0, 0, 0, 4],
      },
      flaggedPsych.length > 0
        ? {
            text: `${flaggedPsych.length} psychosocial hazard${flaggedPsych.length !== 1 ? "s" : ""} identified. Prevention plans required per s.27 VIC OHS (Psychological Health) Regs 2025.`,
            style: "legal",
            color: AMBER,
            margin: [0, 2, 0, 0],
          }
        : { text: "No psychosocial hazards identified.", style: "legal", color: GREEN },

      // ── Section 3: Consultation Record ────────────────────────────────────
      { text: "Part 3 — Consultation Record", style: "h2" },
      {
        text: "Victorian OHS Act 2004 — Section 35 consultation obligation.",
        style: "legal",
        margin: [0, 0, 0, 6],
      },
      {
        table: {
          widths: [120, "*"],
          body: [
            [
              { text: "Persons consulted", style: "h3", margin: [4, 4, 4, 4] },
              { text: data.consultees || "—", style: "tableCell", margin: [4, 4, 4, 4] },
            ],
            [
              { text: "What was raised", style: "h3", margin: [4, 4, 4, 4] },
              { text: data.raised || "—", style: "tableCell", margin: [4, 4, 4, 4] },
            ],
            [
              { text: "Decision made", style: "h3", margin: [4, 4, 4, 4] },
              { text: data.decision || "—", style: "tableCell", margin: [4, 4, 4, 4] },
            ],
          ],
        },
        layout: { hLineColor: () => "#e4e4e7", vLineColor: () => "#e4e4e7" },
        margin: [0, 0, 0, 16],
      },

      // ── Sign-off ───────────────────────────────────────────────────────────
      { text: "Sign-off", style: "h2" },
      {
        table: {
          widths: ["*", "*"],
          body: [
            [
              {
                stack: [
                  { text: "Assessor name", style: "h3" },
                  { text: data.signOffName, fontSize: 13, bold: true, margin: [0, 4, 0, 0] },
                ],
                margin: [6, 8, 6, 8],
              },
              {
                stack: [
                  { text: "Date and time signed", style: "h3" },
                  {
                    text: data.signOffAt.toLocaleString("en-AU", {
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
        text: "\nThis assessment has been completed in accordance with ISO 45001:2018, the Victorian OHS Regulations 2017, and the Victorian OHS (Psychological Health) Regulations 2025.",
        style: "legal",
        margin: [0, 8, 0, 0],
      },
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
