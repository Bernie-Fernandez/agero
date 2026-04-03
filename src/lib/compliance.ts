import { DocumentType } from "@/generated/prisma/client";

export type RagStatus = "green" | "amber" | "red";

export interface ComplianceResult {
  status: RagStatus;
  reasons: string[];
}

const REQUIRED_ORG_DOCS: DocumentType[] = [
  DocumentType.public_liability,
  DocumentType.workers_compensation,
  DocumentType.whs_policy,
];

const EXPIRY_WARN_DAYS = 30;

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function calcOrgCompliance(org: {
  documents: { type: DocumentType; expiryDate: Date | null }[];
  subcontractorOnProjects?: { project: { supervisors: { id: string }[] } }[];
}): ComplianceResult {
  const reasons: string[] = [];
  let status: RagStatus = "green";

  for (const docType of REQUIRED_ORG_DOCS) {
    const doc = org.documents.find((d) => d.type === docType);
    if (!doc) {
      reasons.push(`Missing: ${formatDocType(docType)}`);
      status = "red";
      continue;
    }
    if (doc.expiryDate) {
      const days = daysUntil(doc.expiryDate);
      if (days < 0) {
        reasons.push(`Expired: ${formatDocType(docType)}`);
        status = "red";
      } else if (days <= EXPIRY_WARN_DAYS) {
        reasons.push(`Expiring soon (${days}d): ${formatDocType(docType)}`);
        if (status === "green") status = "amber";
      }
    }
  }

  return { status, reasons };
}

export function calcWorkerCompliance(worker: {
  documents: { type: DocumentType; expiryDate: Date | null }[];
  inductionCompletions: { passed: boolean; template: { type: string } }[];
}): ComplianceResult {
  const reasons: string[] = [];
  let status: RagStatus = "green";

  const whiteCard = worker.documents.find((d) => d.type === DocumentType.white_card);
  if (!whiteCard) {
    reasons.push("Missing: White card");
    status = "red";
  } else if (whiteCard.expiryDate) {
    const days = daysUntil(whiteCard.expiryDate);
    if (days < 0) {
      reasons.push("Expired: White card");
      status = "red";
    } else if (days <= EXPIRY_WARN_DAYS) {
      reasons.push(`Expiring soon (${days}d): White card`);
      if (status === "green") status = "amber";
    }
  }

  const hasGenericInduction = worker.inductionCompletions.some(
    (c) => c.template.type === "generic" && c.passed,
  );
  if (!hasGenericInduction) {
    reasons.push("Generic induction not completed");
    if (status === "green") status = "amber";
  }

  return { status, reasons };
}

export function formatDocType(type: DocumentType): string {
  const labels: Record<DocumentType, string> = {
    public_liability: "Public Liability Insurance",
    workers_compensation: "Workers Compensation",
    whs_policy: "WHS Policy",
    white_card: "White Card",
    trade_licence: "Trade Licence",
    first_aid: "First Aid Certificate",
    swms: "SWMS",
    other: "Other Document",
  };
  return labels[type] ?? type;
}
