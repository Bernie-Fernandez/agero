import { controlLevelLabel, type ControlLevel } from "@/lib/hierarchy-of-controls";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DocDef = Record<string, any>;

const GREY = "#f4f4f5";
const DARK = "#18181b";

export interface RiskAssessmentPdfData {
  title: string;
  projectName: string;
  conductedBy: string;
  conductedAt: Date;
  taskDescription: string;
  location?: string | null;
  complianceNote?: string | null;
  riskFactors?: string[];
  hazards?: { hazard: string; riskRating?: string }[];
  controls: { level: ControlLevel; description: string }[];
  ppeOnly: boolean;
  ppeJustification?: string | null;
  residualRisk?: string | null;
}

export async function generateRiskAssessmentPdf(data: RiskAssessmentPdfData): Promise<Buffer> {
  const { default: PdfPrinter } = await import("pdfmake");
  const fonts = {
    Helvetica: {
      normal: "Helvetica",
      bold: "Helvetica-Bold",
      italics: "Helvetica-Oblique",
      bolditalics: "Helvetica-BoldOblique",
    },
  };
  const printer = new PdfPrinter(fonts);

  const cell = (text: string, opts: DocDef = {}) => ({ text, fontSize: 9, margin: [6, 4, 6, 4], ...opts });
  const head = (text: string) =>
    ({ text, bold: true, fontSize: 9, fillColor: GREY, color: "#71717a", margin: [6, 4, 6, 4] });

  const content: DocDef[] = [
    { text: data.title.toUpperCase(), style: "header" },
    { text: data.projectName, style: "subheader", margin: [0, 4, 0, 0] },
    {
      margin: [0, 16, 0, 0],
      table: {
        widths: ["*", "*"],
        body: [
          [head("Conducted by"), head("Date")],
          [
            cell(data.conductedBy),
            cell(data.conductedAt.toLocaleDateString("en-AU", { timeZone: "Australia/Melbourne" })),
          ],
        ],
      },
      layout: "lightHorizontalLines",
    },
    { text: "Task / Activity", style: "sectionHeader", margin: [0, 18, 0, 6] },
    { text: data.taskDescription, fontSize: 9 },
  ];

  if (data.location) {
    content.push({ text: `Location: ${data.location}`, fontSize: 9, margin: [0, 4, 0, 0], color: "#71717a" });
  }

  if (data.riskFactors?.length) {
    content.push({ text: "Risk Factors", style: "sectionHeader", margin: [0, 18, 0, 6] });
    content.push(...data.riskFactors.map((f) => ({ text: `• ${f}`, fontSize: 9, margin: [0, 1, 0, 1] })));
  }

  if (data.hazards?.length) {
    content.push({ text: "Hazards", style: "sectionHeader", margin: [0, 18, 0, 6] });
    content.push({
      table: {
        widths: ["*", 90],
        body: [
          [head("Hazard"), head("Risk rating")],
          ...data.hazards.map((h) => [cell(h.hazard), cell(h.riskRating ?? "—")]),
        ],
      },
      layout: "lightHorizontalLines",
    });
  }

  content.push({ text: "Control Measures (Hierarchy of Controls)", style: "sectionHeader", margin: [0, 18, 0, 6] });
  content.push({
    table: {
      widths: [170, "*"],
      body: [
        [head("Level"), head("Control")],
        ...data.controls.map((c) => [cell(controlLevelLabel(c.level)), cell(c.description)]),
      ],
    },
    layout: "lightHorizontalLines",
  });

  if (data.ppeOnly) {
    content.push({
      margin: [0, 12, 0, 0],
      table: {
        widths: ["*"],
        body: [
          [
            {
              stack: [
                { text: "PPE-ONLY JUSTIFICATION", bold: true, fontSize: 9, color: "#b45309" },
                {
                  text: "Higher-level controls considered and assessed as not reasonably practicable:",
                  fontSize: 8,
                  color: "#71717a",
                  margin: [0, 2, 0, 4],
                },
                { text: data.ppeJustification ?? "—", fontSize: 9 },
              ],
              fillColor: "#fffbeb",
              margin: [8, 8, 8, 8],
            },
          ],
        ],
      },
      layout: "noBorders",
    });
  }

  if (data.residualRisk) {
    content.push({ text: "Residual Risk", style: "sectionHeader", margin: [0, 18, 0, 6] });
    content.push({ text: data.residualRisk, fontSize: 9 });
  }

  if (data.complianceNote) {
    content.push({
      text: data.complianceNote,
      fontSize: 8,
      color: "#71717a",
      margin: [0, 24, 0, 0],
    });
  }

  const dd: DocDef = {
    defaultStyle: { font: "Helvetica", fontSize: 10, color: DARK },
    pageMargins: [40, 50, 40, 50],
    content,
    styles: {
      header: { fontSize: 16, bold: true, color: DARK },
      subheader: { fontSize: 11, color: "#71717a" },
      sectionHeader: { fontSize: 11, bold: true, color: DARK },
    },
  };

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = printer.createPdfKitDocument(dd);
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}
