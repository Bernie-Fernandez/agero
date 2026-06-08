"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { createStorageAdminClient } from "@/lib/supabase/server";
import { generateIncidentPdf } from "@/lib/pdf/incident-pdf";
import type { IncidentType } from "@/generated/prisma/client";

export type IncidentState = { error?: string };

export interface IncidentPayload {
  incidentType: IncidentType;
  incidentAt: string;
  location: string;
  description: string;
  injuredPersonName: string;
  injuredPersonOrg: string;
  workSafeNotifiable: boolean;
  workSafeRefNumber: string;
  workSafeNotifiedAt: string;
  psychosocialDetails: string;
  witnesses: { name: string; contact: string }[];
  immediateActions: string;
}

export async function createIncidentReport(
  projectId: string,
  _prev: IncidentState,
  formData: FormData,
): Promise<IncidentState> {
  const user = await requireRole(AGERO_ROLES);

  const raw = formData.get("payload") as string | null;
  if (!raw) return { error: "Missing form data." };
  let payload: IncidentPayload;
  try {
    payload = JSON.parse(raw) as IncidentPayload;
  } catch {
    return { error: "Invalid form data." };
  }

  if (!payload.incidentType) return { error: "Incident type is required." };
  if (!payload.incidentAt) return { error: "Incident date/time is required." };
  if (!payload.location.trim()) return { error: "Location is required." };
  if (!payload.description.trim()) return { error: "Description is required." };

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, organisationId: true },
  });
  if (!safetyProject || safetyProject.organisationId !== user.organisationId) {
    return { error: "Project not found." };
  }

  const incidentAt = new Date(payload.incidentAt);

  let reportUrl: string | null = null;
  try {
    const pdfBuffer = await generateIncidentPdf({
      projectName: safetyProject.name,
      reportedBy: user.name ?? user.email,
      incidentType: payload.incidentType,
      incidentAt,
      location: payload.location,
      description: payload.description,
      injuredPersonName: payload.injuredPersonName,
      injuredPersonOrg: payload.injuredPersonOrg,
      workSafeNotifiable: payload.workSafeNotifiable,
      workSafeRefNumber: payload.workSafeRefNumber,
      psychosocialDetails: payload.psychosocialDetails,
      witnesses: payload.witnesses,
      immediateActions: payload.immediateActions,
    });
    const storage = createStorageAdminClient();
    const pdfPath = `incident-reports/${projectId}/${Date.now()}.pdf`;
    const { error: pdfErr } = await storage
      .from("documents")
      .upload(pdfPath, pdfBuffer, { contentType: "application/pdf" });
    if (!pdfErr) {
      const { data } = storage.from("documents").getPublicUrl(pdfPath);
      reportUrl = data.publicUrl;
    }
  } catch {}

  const incident = await prisma.incidentReport.create({
    data: {
      projectId,
      reportedById: user.id,
      incidentType: payload.incidentType,
      incidentAt,
      location: payload.location,
      description: payload.description,
      injuredPersonName: payload.injuredPersonName || undefined,
      injuredPersonOrg: payload.injuredPersonOrg || undefined,
      workSafeNotifiable: payload.workSafeNotifiable,
      workSafeRefNumber: payload.workSafeRefNumber || undefined,
      workSafeNotifiedAt: payload.workSafeNotifiedAt ? new Date(payload.workSafeNotifiedAt) : undefined,
      psychosocialDetails: payload.psychosocialDetails || undefined,
      witnesses: payload.witnesses,
      immediateActions: payload.immediateActions || undefined,
      submittedAt: new Date(),
      reportUrl,
    },
  });

  // ConsultationEvent
  prisma.consultationEvent
    .create({
      data: {
        projectId,
        eventType: "INCIDENT",
        referenceId: incident.id,
        consultedPersons: payload.witnesses.length
          ? payload.witnesses
          : [{ name: user.name ?? user.email, role: "Reporter" }],
        notes: `${payload.incidentType} incident: ${payload.description.slice(0, 100)}`,
        eventDate: incidentAt,
      },
    })
    .catch(() => {});

  revalidatePath(`/projects/${projectId}/incident`);
  redirect(`/projects/${projectId}/incident`);
}
