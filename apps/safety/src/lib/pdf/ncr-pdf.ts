// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DocDef = Record<string, any>;

const GREY = "#f4f4f5";
const DARK = "#18181b";

export interface NcrPdfData {
  ncrNumber: string;
  projectName: string;
  raisedAt: Date;
  raisedBy: string;
  description: string;
  correctiveAction: string;
  disposition: string;
  ageroSignatureUrl: string | null;
  ageroName: string;
  contractorName: string;
  contractorSignatureUrl: string | null;
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

export async function generateNcrPdf(data: NcrPdfData): Promise<Buffer> {
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

  const [ageroSig, contractorSig] = await Promise.all([
    data.ageroSignatureUrl ? fetchImageAsDataUrl(data.ageroSignatureUrl) : null,
    data.contractorSignatureUrl ? fetchImageAsDataUrl(data.contractorSignatureUrl) : null,
  ]);

  function sigBlock(label: string, name: string, sigDataUrl: string | null) {
    return {
      margin: [0, 0, 0, 0],
      columns: [
        {
          width: "*",
          stack: [
            { text: label, fontSize: 9, bold: true, color: "#71717a" },
            { text: name, fontSize: 9, margin: [0, 2, 0, 4] },
            sigDataUrl
              ? { image: sigDataUrl, width: 120, height: 40 }
              : { text: "Signature not captured", fontSize: 9, color: "#71717a" },
          ],
        },
      ],
    };
  }

  const dd: DocDef = {
    defaultStyle: { font: "Helvetica", fontSize: 10, color: DARK },
    pageMargins: [40, 50, 40, 50],
    content: [
      { text: "NON-CONFORMANCE REPORT", style: "header" },
      { text: `${data.ncrNumber} · ${data.projectName}`, style: "subheader", margin: [0, 4, 0, 16] },
      {
        table: {
          widths: ["*", "*"],
          body: [
            [
              { text: "Date raised", bold: true, fontSize: 9, fillColor: GREY, color: "#71717a", margin: [6, 4, 6, 4] },
              { text: "Raised by", bold: true, fontSize: 9, fillColor: GREY, color: "#71717a", margin: [6, 4, 6, 4] },
            ],
            [
              { text: data.raisedAt.toLocaleDateString("en-AU"), fontSize: 9, margin: [6, 4, 6, 4] },
              { text: data.raisedBy, fontSize: 9, margin: [6, 4, 6, 4] },
            ],
          ],
        },
        layout: "lightHorizontalLines",
      },
      { text: "Part A — Description of Non-Conformance", style: "sectionHeader", margin: [0, 20, 0, 6] },
      { text: data.description, fontSize: 9, margin: [0, 0, 0, 16] },
      { text: "Part B — Corrective Action Required", style: "sectionHeader", margin: [0, 0, 0, 6] },
      { text: data.correctiveAction, fontSize: 9, margin: [0, 0, 0, 16] },
      { text: "Part C — Disposition", style: "sectionHeader", margin: [0, 0, 0, 6] },
      { text: data.disposition, fontSize: 9, margin: [0, 0, 0, 24] },
      { text: "Signatures", style: "sectionHeader", margin: [0, 0, 0, 12] },
      {
        columns: [
          sigBlock("Agero Manager", data.ageroName, ageroSig),
          sigBlock("Contractor / Worker", data.contractorName, contractorSig),
        ],
        columnGap: 24,
      },
      {
        margin: [0, 20, 0, 0],
        text: "By signing this document, both parties acknowledge the non-conformance and agree to the corrective action and disposition stated above.",
        fontSize: 8,
        color: "#71717a",
        italics: true,
      },
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
