"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { createStorageAdminClient } from "@/lib/supabase/server";
import { generateToolboxPdf } from "@/lib/pdf/toolbox-pdf";

export type ToolboxState = { error?: string };

export interface ToolboxPayload {
  conductedAt: string;
  topics: string[];
  attendees: { name: string; company: string; signatureDataUrl: string }[];
  actions: { description: string; assignedTo: string; dueDate: string }[];
}

export async function createToolboxMeeting(
  projectId: string,
  _prev: ToolboxState,
  formData: FormData,
): Promise<ToolboxState> {
  const user = await requireRole(AGERO_ROLES);

  const raw = formData.get("payload") as string | null;
  if (!raw) return { error: "Missing form data." };
  let payload: ToolboxPayload;
  try {
    payload = JSON.parse(raw) as ToolboxPayload;
  } catch {
    return { error: "Invalid form data." };
  }

  if (!payload.conductedAt) return { error: "Meeting date is required." };
  if (!payload.topics.length) return { error: "At least one topic is required." };
  if (!payload.attendees.length) return { error: "At least one attendee is required." };

  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, organisationId: true },
  });
  if (!safetyProject || safetyProject.organisationId !== user.organisationId) {
    return { error: "Project not found." };
  }

  const storage = createStorageAdminClient();

  // Upload attendee signatures
  const attendeesWithSigs = await Promise.all(
    payload.attendees.map(async (a) => {
      if (!a.signatureDataUrl || !a.signatureDataUrl.startsWith("data:")) {
        return { name: a.name, company: a.company, signatureUrl: null };
      }
      const buf = Buffer.from(a.signatureDataUrl.replace(/^data:image\/\w+;base64,/, ""), "base64");
      const path = `toolbox-signatures/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
      const { error } = await storage.from("documents").upload(path, buf, { contentType: "image/png" });
      if (error) return { name: a.name, company: a.company, signatureUrl: null };
      const { data } = storage.from("documents").getPublicUrl(path);
      return { name: a.name, company: a.company, signatureUrl: data.publicUrl };
    }),
  );

  const conductedAt = new Date(payload.conductedAt);

  // Generate PDF
  let reportUrl: string | null = null;
  try {
    const pdfBuffer = await generateToolboxPdf({
      projectName: safetyProject.name,
      conductedAt,
      conductedBy: user.name ?? user.email,
      topics: payload.topics,
      attendees: attendeesWithSigs,
      actions: payload.actions,
    });
    const pdfPath = `toolbox-reports/${projectId}/${Date.now()}.pdf`;
    const { error: pdfErr } = await storage
      .from("documents")
      .upload(pdfPath, pdfBuffer, { contentType: "application/pdf" });
    if (!pdfErr) {
      const { data } = storage.from("documents").getPublicUrl(pdfPath);
      reportUrl = data.publicUrl;
    }
  } catch {}

  const meeting = await prisma.toolboxMeeting.create({
    data: {
      projectId,
      conductedById: user.id,
      conductedAt,
      topics: payload.topics,
      attendees: attendeesWithSigs,
      actions: payload.actions,
      reportUrl,
    },
  });

  // ConsultationEvent (fire-and-forget)
  prisma.consultationEvent
    .create({
      data: {
        projectId,
        eventType: "TOOLBOX_MEETING",
        referenceId: meeting.id,
        consultedPersons: attendeesWithSigs.map((a) => ({ name: a.name, company: a.company })),
        notes: `Toolbox meeting — ${payload.topics.join(", ")}`,
        eventDate: conductedAt,
      },
    })
    .catch(() => {});

  revalidatePath(`/projects/${projectId}/toolbox`);
  redirect(`/projects/${projectId}/toolbox`);
}
