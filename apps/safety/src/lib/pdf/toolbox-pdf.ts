// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DocDef = Record<string, any>;

const GREY = "#f4f4f5";
const DARK = "#18181b";

export interface ToolboxPdfData {
  projectName: string;
  conductedAt: Date;
  conductedBy: string;
  topics: string[];
  attendees: { name: string; company: string; signatureUrl: string | null }[];
  actions: { description: string; assignedTo: string; dueDate: string }[];
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    const ct = res.headers.get("content-type") ?? "image/png";
    return `data:${ct};base64,${b64}`;
  } catch {
    return null;
  }
}

export async function generateToolboxPdf(data: ToolboxPdfData): Promise<Buffer> {
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

  const attendeeSigs = await Promise.all(
    data.attendees.map(async (a) => {
      const sig = a.signatureUrl ? await fetchImageAsDataUrl(a.signatureUrl) : null;
      return { ...a, sigDataUrl: sig };
    }),
  );

  const attendeeRows = attendeeSigs.map((a) => [
    { text: a.name, fontSize: 9 },
    { text: a.company, fontSize: 9 },
    a.sigDataUrl
      ? { image: a.sigDataUrl, width: 60, height: 20 }
      : { text: "—", fontSize: 9, color: "#71717a" },
  ]);

  const actionRows = data.actions.map((a) => [
    { text: a.description, fontSize: 9 },
    { text: a.assignedTo, fontSize: 9 },
    { text: a.dueDate, fontSize: 9 },
  ]);

  const dd: DocDef = {
    defaultStyle: { font: "Helvetica", fontSize: 10, color: DARK },
    pageMargins: [40, 50, 40, 50],
    content: [
      { text: "TOOLBOX MEETING RECORD", style: "header" },
      { text: `${data.projectName}`, style: "subheader", margin: [0, 4, 0, 0] },
      {
        margin: [0, 16, 0, 0],
        table: {
          widths: ["*", "*"],
          body: [
            [
              { text: "Date", bold: true, fontSize: 9, fillColor: GREY, color: "#71717a", margin: [6, 4, 6, 4] },
              { text: "Conducted by", bold: true, fontSize: 9, fillColor: GREY, color: "#71717a", margin: [6, 4, 6, 4] },
            ],
            [
              { text: data.conductedAt.toLocaleDateString("en-AU"), fontSize: 9, margin: [6, 4, 6, 4] },
              { text: data.conductedBy, fontSize: 9, margin: [6, 4, 6, 4] },
            ],
          ],
        },
        layout: "lightHorizontalLines",
      },
      { text: "Topics Discussed", style: "sectionHeader", margin: [0, 20, 0, 8] },
      ...data.topics.map((t) => ({ text: `• ${t}`, fontSize: 9, margin: [0, 2, 0, 2] })),
      { text: "Attendees", style: "sectionHeader", margin: [0, 20, 0, 8] },
      {
        table: {
          widths: ["*", "*", 80],
          body: [
            [
              { text: "Name", bold: true, fontSize: 9, fillColor: GREY, color: "#71717a", margin: [6, 4, 6, 4] },
              { text: "Company", bold: true, fontSize: 9, fillColor: GREY, color: "#71717a", margin: [6, 4, 6, 4] },
              { text: "Signature", bold: true, fontSize: 9, fillColor: GREY, color: "#71717a", margin: [6, 4, 6, 4] },
            ],
            ...attendeeRows.map((r) => r.map((c) => ({ ...c, margin: [6, 4, 6, 4] }))),
          ],
        },
        layout: "lightHorizontalLines",
      },
      ...(data.actions.length
        ? [
            { text: "Actions", style: "sectionHeader", margin: [0, 20, 0, 8] },
            {
              table: {
                widths: ["*", "*", 80],
                body: [
                  [
                    { text: "Action", bold: true, fontSize: 9, fillColor: GREY, color: "#71717a", margin: [6, 4, 6, 4] },
                    { text: "Assigned to", bold: true, fontSize: 9, fillColor: GREY, color: "#71717a", margin: [6, 4, 6, 4] },
                    { text: "Due date", bold: true, fontSize: 9, fillColor: GREY, color: "#71717a", margin: [6, 4, 6, 4] },
                  ],
                  ...actionRows.map((r) => r.map((c) => ({ ...c, margin: [6, 4, 6, 4] }))),
                ],
              },
              layout: "lightHorizontalLines",
            },
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
