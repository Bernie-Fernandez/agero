// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DocDef = Record<string, any>;

const GREY = "#f4f4f5";
const DARK = "#18181b";

export interface DilapidationPdfData {
  projectName: string;
  conductedAt: Date;
  conductedBy: string;
  pins: { pinNumber: number; description: string; condition: string; photoUrls: string[] }[];
  notes: string;
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${ct};base64,${b64}`;
  } catch {
    return null;
  }
}

export async function generateDilapidationPdf(data: DilapidationPdfData): Promise<Buffer> {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [
    { text: "DILAPIDATION SURVEY REPORT", style: "header" },
    { text: `${data.projectName}`, style: "subheader", margin: [0, 4, 0, 16] },
    {
      table: {
        widths: ["*", "*"],
        body: [
          [
            { text: "Survey date", bold: true, fontSize: 9, fillColor: GREY, color: "#71717a", margin: [6, 4, 6, 4] },
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
    { text: `Survey Items — ${data.pins.length} recorded`, style: "sectionHeader", margin: [0, 20, 0, 8] },
  ];

  for (const pin of data.pins) {
    content.push({
      margin: [0, 4, 0, 12],
      stack: [
        {
          table: {
            widths: [30, "*", 120],
            body: [
              [
                { text: `Pin ${pin.pinNumber}`, bold: true, fontSize: 9, fillColor: GREY, margin: [6, 4, 6, 4] },
                { text: pin.description, fontSize: 9, margin: [6, 4, 6, 4] },
                {
                  text: `Condition: ${pin.condition}`,
                  fontSize: 9,
                  color:
                    pin.condition === "Good" ? "#16a34a" : pin.condition === "Damaged" ? "#dc2626" : "#d97706",
                  margin: [6, 4, 6, 4],
                },
              ],
            ],
          },
          layout: "lightHorizontalLines",
        },
      ],
    });

    // Photos (first 2 only to keep PDF manageable)
    const photoUrls = pin.photoUrls.slice(0, 2);
    if (photoUrls.length) {
      const photoDataUrls = await Promise.all(photoUrls.map(fetchImageAsDataUrl));
      const validPhotos = photoDataUrls.filter(Boolean) as string[];
      if (validPhotos.length) {
        content.push({
          columns: validPhotos.map((d) => ({ image: d, width: 180, margin: [0, 0, 8, 8] })),
        });
      }
    }
  }

  if (data.notes) {
    content.push(
      { text: "Notes", style: "sectionHeader", margin: [0, 16, 0, 6] },
      { text: data.notes, fontSize: 9 },
    );
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
