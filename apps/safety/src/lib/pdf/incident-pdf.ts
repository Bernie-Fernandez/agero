// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DocDef = Record<string, any>;

const GREY = "#f4f4f5";
const DARK = "#18181b";
const RED = "#dc2626";

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  INJURY: "Injury",
  NEAR_MISS: "Near Miss",
  PROPERTY_DAMAGE: "Property Damage",
  ENVIRONMENTAL: "Environmental",
  PSYCHOLOGICAL: "Psychological",
  OTHER: "Other",
};

export interface IncidentPdfData {
  projectName: string;
  reportedBy: string;
  incidentType: string;
  incidentAt: Date;
  location: string;
  description: string;
  injuredPersonName?: string;
  injuredPersonOrg?: string;
  workSafeNotifiable: boolean;
  workSafeRefNumber?: string;
  psychosocialDetails?: string;
  witnesses: { name: string; contact: string }[];
  immediateActions?: string;
}

export async function generateIncidentPdf(data: IncidentPdfData): Promise<Buffer> {
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
    { text: "INCIDENT INVESTIGATION REPORT", style: "header" },
    {
      text: data.workSafeNotifiable
        ? `⚠ WorkSafe Notifiable — ${data.projectName}`
        : data.projectName,
      style: "subheader",
      color: data.workSafeNotifiable ? RED : "#71717a",
      margin: [0, 4, 0, 16],
    },
    {
      table: {
        widths: ["*", "*", "*"],
        body: [
          [
            { text: "Incident type", bold: true, fontSize: 9, fillColor: GREY, color: "#71717a", margin: [6, 4, 6, 4] },
            { text: "Date / time", bold: true, fontSize: 9, fillColor: GREY, color: "#71717a", margin: [6, 4, 6, 4] },
            { text: "Location", bold: true, fontSize: 9, fillColor: GREY, color: "#71717a", margin: [6, 4, 6, 4] },
          ],
          [
            { text: INCIDENT_TYPE_LABELS[data.incidentType] ?? data.incidentType, fontSize: 9, margin: [6, 4, 6, 4] },
            { text: data.incidentAt.toLocaleString("en-AU"), fontSize: 9, margin: [6, 4, 6, 4] },
            { text: data.location, fontSize: 9, margin: [6, 4, 6, 4] },
          ],
        ],
      },
      layout: "lightHorizontalLines",
    },
    { text: "Description", style: "sectionHeader", margin: [0, 20, 0, 6] },
    { text: data.description, fontSize: 9 },
  ];

  if (data.injuredPersonName) {
    content.push(
      { text: "Injured / Affected Person", style: "sectionHeader", margin: [0, 16, 0, 6] },
      { text: `${data.injuredPersonName}${data.injuredPersonOrg ? ` — ${data.injuredPersonOrg}` : ""}`, fontSize: 9 },
    );
  }

  if (data.workSafeNotifiable) {
    content.push(
      { text: "WorkSafe Victoria Notification", style: "sectionHeader", margin: [0, 16, 0, 6], color: RED },
      {
        table: {
          widths: ["*", "*"],
          body: [
            [
              { text: "Notifiable", bold: true, fontSize: 9, fillColor: GREY, margin: [6, 4, 6, 4] },
              { text: "Reference number", bold: true, fontSize: 9, fillColor: GREY, margin: [6, 4, 6, 4] },
            ],
            [
              { text: "Yes — notification required within 48 hours", fontSize: 9, color: RED, margin: [6, 4, 6, 4] },
              { text: data.workSafeRefNumber || "Pending", fontSize: 9, margin: [6, 4, 6, 4] },
            ],
          ],
        },
        layout: "lightHorizontalLines",
      },
    );
  }

  if (data.incidentType === "PSYCHOLOGICAL" && data.psychosocialDetails) {
    content.push(
      { text: "Psychosocial Details (VIC Psych Health Regs 2025)", style: "sectionHeader", margin: [0, 16, 0, 6] },
      { text: data.psychosocialDetails, fontSize: 9 },
    );
  }

  if (data.witnesses.length) {
    content.push(
      { text: "Witnesses", style: "sectionHeader", margin: [0, 16, 0, 6] },
      {
        table: {
          widths: ["*", "*"],
          body: [
            [
              { text: "Name", bold: true, fontSize: 9, fillColor: GREY, margin: [6, 4, 6, 4] },
              { text: "Contact", bold: true, fontSize: 9, fillColor: GREY, margin: [6, 4, 6, 4] },
            ],
            ...data.witnesses.map((w) => [
              { text: w.name, fontSize: 9, margin: [6, 4, 6, 4] },
              { text: w.contact, fontSize: 9, margin: [6, 4, 6, 4] },
            ]),
          ],
        },
        layout: "lightHorizontalLines",
      },
    );
  }

  if (data.immediateActions) {
    content.push(
      { text: "Immediate Actions Taken", style: "sectionHeader", margin: [0, 16, 0, 6] },
      { text: data.immediateActions, fontSize: 9 },
    );
  }

  content.push(
    { text: `Reported by: ${data.reportedBy}`, fontSize: 8, color: "#71717a", margin: [0, 24, 0, 0] },
    { text: "This report must be retained for a minimum of 5 years (ISO 45001 Cl 10.2).", fontSize: 8, color: "#71717a", italics: true },
  );

  const dd: DocDef = {
    defaultStyle: { font: "Helvetica", fontSize: 10, color: DARK },
    pageMargins: [40, 50, 40, 50],
    content,
    styles: {
      header: { fontSize: 16, bold: true, color: DARK },
      subheader: { fontSize: 11 },
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
