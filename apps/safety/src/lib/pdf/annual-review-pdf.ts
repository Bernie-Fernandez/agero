// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DocDef = Record<string, any>;

const GREY = "#f4f4f5";
const DARK = "#18181b";

export interface AnnualReviewPdfData {
  templateName: string;
  templateKey: string;
  version: number;
  reviewedAt: Date;
  reviewerName: string;
  isoClauses: string[];
  complianceCodes: string[];
  outcome: string;
  checklist: { item: string; clause?: string; confirmed: boolean; notes?: string }[];
  notes?: string | null;
}

export async function generateAnnualReviewPdf(data: AnnualReviewPdfData): Promise<Buffer> {
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
  const head = (text: string) => ({ text, bold: true, fontSize: 9, fillColor: GREY, color: "#71717a", margin: [6, 4, 6, 4] });

  const reviewDateStr = data.reviewedAt.toLocaleDateString("en-AU", { timeZone: "Australia/Melbourne" });

  const dd: DocDef = {
    defaultStyle: { font: "Helvetica", fontSize: 10, color: DARK },
    pageMargins: [40, 50, 40, 60],
    footer: (currentPage: number, pageCount: number) => ({
      margin: [40, 0, 40, 0],
      columns: [
        { text: `${data.templateName} · Version ${data.version} · Reviewed ${reviewDateStr}`, fontSize: 7, color: "#a1a1aa" },
        { text: `Page ${currentPage} of ${pageCount}`, fontSize: 7, color: "#a1a1aa", alignment: "right" },
      ],
    }),
    content: [
      { text: "ANNUAL WHS DOCUMENTATION REVIEW", style: "header" },
      { text: data.templateName, style: "subheader", margin: [0, 4, 0, 0] },
      {
        margin: [0, 16, 0, 0],
        table: {
          widths: ["*", "*", "*"],
          body: [
            [head("Version"), head("Reviewed by"), head("Review date")],
            [cell(`v${data.version}`), cell(data.reviewerName), cell(reviewDateStr)],
          ],
        },
        layout: "lightHorizontalLines",
      },
      { text: "Applicable ISO 45001 clauses", style: "sectionHeader", margin: [0, 18, 0, 4] },
      { text: data.isoClauses.join(", ") || "—", fontSize: 9 },
      { text: "Applicable compliance codes / legislation", style: "sectionHeader", margin: [0, 12, 0, 4] },
      { text: data.complianceCodes.join("; ") || "—", fontSize: 9 },
      { text: "Review checklist", style: "sectionHeader", margin: [0, 18, 0, 6] },
      {
        table: {
          widths: [16, "*", 60],
          body: [
            [head(""), head("Item"), head("Clause")],
            ...data.checklist.map((c) => [
              cell(c.confirmed ? "✓" : "✗", { color: c.confirmed ? "#16a34a" : "#dc2626", bold: true }),
              cell(c.item + (c.notes ? `\n${c.notes}` : "")),
              cell(c.clause ?? "—"),
            ]),
          ],
        },
        layout: "lightHorizontalLines",
      },
      { text: "Outcome", style: "sectionHeader", margin: [0, 18, 0, 4] },
      { text: data.outcome === "UPDATED" ? "Document updated — new version issued." : "Document confirmed current — no changes required.", fontSize: 9 },
      ...(data.notes ? [{ text: "Reviewer notes", style: "sectionHeader", margin: [0, 12, 0, 4] }, { text: data.notes, fontSize: 9 }] : []),
    ],
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
