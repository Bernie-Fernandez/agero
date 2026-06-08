// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DocDef = Record<string, any>;

const GREY = "#f4f4f5";
const DARK = "#18181b";
const GREEN = "#16a34a";
const RED = "#dc2626";

export interface SafetyWalkPdfData {
  projectName: string;
  conductedAt: Date;
  conductedBy: string;
  items: { id: string; question: string; answer: "YES" | "NO" | "NA"; notes?: string }[];
  observations: string;
}

export async function generateSafetyWalkPdf(data: SafetyWalkPdfData): Promise<Buffer> {
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

  const yesCount = data.items.filter((i) => i.answer === "YES").length;
  const noCount = data.items.filter((i) => i.answer === "NO").length;
  const naCount = data.items.filter((i) => i.answer === "NA").length;

  const rows = data.items.map((item, i) => [
    { text: String(i + 1), fontSize: 8, margin: [4, 4, 4, 4] },
    { text: item.question, fontSize: 8, margin: [4, 4, 4, 4] },
    {
      text: item.answer,
      fontSize: 8,
      bold: true,
      color: item.answer === "YES" ? GREEN : item.answer === "NO" ? RED : "#71717a",
      margin: [4, 4, 4, 4],
    },
    { text: item.notes ?? "", fontSize: 8, color: "#71717a", margin: [4, 4, 4, 4] },
  ]);

  const dd: DocDef = {
    defaultStyle: { font: "Helvetica", fontSize: 10, color: DARK },
    pageMargins: [40, 50, 40, 50],
    content: [
      { text: "SITE SAFETY WALK", style: "header" },
      { text: `${data.projectName}`, style: "subheader", margin: [0, 4, 0, 16] },
      {
        table: {
          widths: ["*", "*", "*"],
          body: [
            [
              { text: "Date", bold: true, fontSize: 9, fillColor: GREY, color: "#71717a", margin: [6, 4, 6, 4] },
              { text: "Conducted by", bold: true, fontSize: 9, fillColor: GREY, color: "#71717a", margin: [6, 4, 6, 4] },
              { text: "Result", bold: true, fontSize: 9, fillColor: GREY, color: "#71717a", margin: [6, 4, 6, 4] },
            ],
            [
              { text: data.conductedAt.toLocaleDateString("en-AU"), fontSize: 9, margin: [6, 4, 6, 4] },
              { text: data.conductedBy, fontSize: 9, margin: [6, 4, 6, 4] },
              {
                text: `${yesCount} YES · ${noCount} NO · ${naCount} N/A`,
                fontSize: 9,
                color: noCount > 0 ? RED : GREEN,
                margin: [6, 4, 6, 4],
              },
            ],
          ],
        },
        layout: "lightHorizontalLines",
      },
      { text: "Checklist", style: "sectionHeader", margin: [0, 20, 0, 8] },
      {
        table: {
          widths: [20, "*", 30, "*"],
          body: [
            [
              { text: "#", bold: true, fontSize: 8, fillColor: GREY, margin: [4, 4, 4, 4] },
              { text: "Item", bold: true, fontSize: 8, fillColor: GREY, margin: [4, 4, 4, 4] },
              { text: "Answer", bold: true, fontSize: 8, fillColor: GREY, margin: [4, 4, 4, 4] },
              { text: "Notes", bold: true, fontSize: 8, fillColor: GREY, margin: [4, 4, 4, 4] },
            ],
            ...rows,
          ],
        },
        layout: "lightHorizontalLines",
      },
      ...(data.observations
        ? [
            { text: "Observations", style: "sectionHeader", margin: [0, 20, 0, 6] },
            { text: data.observations, fontSize: 9 },
          ]
        : []),
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
