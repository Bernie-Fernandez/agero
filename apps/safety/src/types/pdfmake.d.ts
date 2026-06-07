// Minimal type shim for pdfmake 0.3.x (no bundled .d.ts files).
// Covers the PdfPrinter Node.js API used in lib/pdf/pre-start-pdf.ts.
declare module "pdfmake" {
  import { EventEmitter } from "events";

  interface PdfKitDocument extends EventEmitter {
    end(): void;
  }

  interface FontDescriptor {
    normal?: string;
    bold?: string;
    italics?: string;
    bolditalics?: string;
  }

  class PdfPrinter {
    constructor(fonts: Record<string, FontDescriptor>);
    createPdfKitDocument(docDefinition: object, options?: object): PdfKitDocument;
  }

  export = PdfPrinter;
}
