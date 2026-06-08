"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { createStorageAdminClient } from "@/lib/supabase/server";
import { generateNcrPdf } from "@/lib/pdf/ncr-pdf";

export type NcrState = { error?: string };

export interface NcrPayload {
  raisedAt: string;
  description: string;
  correctiveAction: string;
  disposition: string;
  ageroSignatureDataUrl: string;
  contractorName: string;
  contractorSignatureDataUrl: string;
}

async function generateNcrNumber(projectId: string): Promise<string> {
  const count = await prisma.nonConformanceReport.count({ where: { projectId } });
  return `NCR-${(count + 1).toString().padStart(3, "0")}`;
}

export async function createNcr(
  projectId: string,
  _prev: NcrState,
  formData: FormData,
): Promise<NcrState> {
  const user = await requireRole(AGERO_ROLES);

  const raw = formData.get("payload") as string | null;
  if (!raw) return { error: "Missing form data." };
  let payload: NcrPayload;
  try {
    payload = JSON.parse(raw) as NcrPayload;
  } catch {
    return { error: "Invalid form data." };
  }

  if (!payload.description.trim()) return { error: "Description is required." };
  if (!payload.correctiveAction.trim()) return { error: "Corrective action is required." };
  if (!payload.disposition.trim()) return { error: "Disposition is required." };
  if (!payload.ageroSignatureDataUrl) return { error: "Agero manager signature is required." };
  if (!payload.contractorName.trim()) return { error: "Contractor name is required." };
  if (!payload.contractorSignatureDataUrl) return { error: "Contractor signature is required." };

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, organisationId: true },
  });
  if (!safetyProject || safetyProject.organisationId !== user.organisationId) {
    return { error: "Project not found." };
  }

  const storage = createStorageAdminClient();

  async function uploadSig(dataUrl: string, name: string): Promise<string | null> {
    const buf = Buffer.from(dataUrl.replace(/^data:image\/\w+;base64,/, ""), "base64");
    const path = `ncr-signatures/${projectId}/${Date.now()}-${name}.png`;
    const { error } = await storage.from("documents").upload(path, buf, { contentType: "image/png" });
    if (error) return null;
    const { data } = storage.from("documents").getPublicUrl(path);
    return data.publicUrl;
  }

  const [ageroSigUrl, contractorSigUrl] = await Promise.all([
    uploadSig(payload.ageroSignatureDataUrl, "agero"),
    uploadSig(payload.contractorSignatureDataUrl, "contractor"),
  ]);

  const ncrNumber = await generateNcrNumber(projectId);
  const raisedAt = new Date(payload.raisedAt);

  let reportUrl: string | null = null;
  try {
    const pdfBuffer = await generateNcrPdf({
      ncrNumber,
      projectName: safetyProject.name,
      raisedAt,
      raisedBy: user.name ?? user.email,
      description: payload.description,
      correctiveAction: payload.correctiveAction,
      disposition: payload.disposition,
      ageroSignatureUrl: ageroSigUrl,
      ageroName: user.name ?? user.email,
      contractorName: payload.contractorName,
      contractorSignatureUrl: contractorSigUrl,
    });
    const pdfPath = `ncr-reports/${projectId}/${Date.now()}.pdf`;
    const { error: pdfErr } = await storage
      .from("documents")
      .upload(pdfPath, pdfBuffer, { contentType: "application/pdf" });
    if (!pdfErr) {
      const { data } = storage.from("documents").getPublicUrl(pdfPath);
      reportUrl = data.publicUrl;
    }
  } catch {}

  const ncr = await prisma.nonConformanceReport.create({
    data: {
      projectId,
      ncrNumber,
      raisedById: user.id,
      raisedAt,
      description: payload.description,
      correctiveAction: payload.correctiveAction,
      disposition: payload.disposition,
      ageroSignatureUrl: ageroSigUrl,
      ageroSignedById: user.id,
      ageroSignedAt: new Date(),
      contractorName: payload.contractorName,
      contractorSignatureUrl: contractorSigUrl,
      contractorSignedAt: new Date(),
      submittedAt: new Date(),
      reportUrl,
    },
  });

  // ConsultationEvent
  prisma.consultationEvent
    .create({
      data: {
        projectId,
        eventType: "NCR",
        referenceId: ncr.id,
        consultedPersons: [
          { name: user.name ?? user.email, role: "Agero Manager" },
          { name: payload.contractorName, role: "Contractor" },
        ],
        notes: `NCR ${ncrNumber}: ${payload.description.slice(0, 100)}`,
        eventDate: raisedAt,
      },
    })
    .catch(() => {});

  revalidatePath(`/projects/${projectId}/ncr`);
  redirect(`/projects/${projectId}/ncr`);
}
