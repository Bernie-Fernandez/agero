"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, AGERO_ROLES } from "@/lib/auth";
import { createStorageAdminClient } from "@/lib/supabase/server";

export interface PlanSection {
  sectionId: string;
  sectionName: string;
  planNote: string;
  plannedCompletionDate: string;
}

export interface SitePrepPlanPayload {
  sections: PlanSection[];
  signOffDropdownUserId: string;
  signatureDataUrl?: string;
}

export interface PlanSubmitState {
  error?: string;
}

export async function submitSitePrepPlan(
  safetyProjectId: string,
  _prev: PlanSubmitState,
  formData: FormData,
): Promise<PlanSubmitState> {
  const user = await requireRole(AGERO_ROLES);

  const raw = formData.get("payload")?.toString();
  if (!raw) return { error: "Form data missing." };

  let payload: SitePrepPlanPayload;
  try {
    payload = JSON.parse(raw) as SitePrepPlanPayload;
  } catch {
    return { error: "Invalid form data." };
  }

  const { sections, signOffDropdownUserId, signatureDataUrl } = payload;

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!signOffDropdownUserId) return { error: "Please select a sign-off person." };

  // Resolve sign-off name server-side from the dropdown user ID
  const signOffUser = await prisma.user.findUnique({
    where: { id: signOffDropdownUserId },
    select: { name: true, email: true },
  });
  if (!signOffUser) return { error: "Selected sign-off user not found." };
  const signOffName = signOffUser.name ?? signOffUser.email;

  const incomplete = sections.filter((s) => !s.planNote.trim());
  if (incomplete.length > 0) {
    return {
      error: `Plan notes required for: ${incomplete.map((s) => s.sectionName).join(", ")}.`,
    };
  }

  // ── Verify pre-start exists ────────────────────────────────────────────────
  const safetyProject = await prisma.safetyProject.findUnique({
    where: { id: safetyProjectId },
    include: { preStartAssessments: { take: 1, select: { id: true } } },
  });
  if (!safetyProject) return { error: "Project not found." };
  if (safetyProject.preStartAssessments.length === 0) {
    return { error: "Pre-Start Risk Assessment must be completed before the Site Preparation Plan." };
  }

  const signOffAt = new Date();

  // ── Upload signature ───────────────────────────────────────────────────────
  let signatureUrl: string | null = null;
  if (signatureDataUrl) {
    try {
      const base64 = signatureDataUrl.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64, "base64");
      const storage = createStorageAdminClient();
      const path = `site-prep/signatures/plan-${safetyProjectId}-${Date.now()}.png`;
      const { error: uploadError } = await storage
        .from("documents")
        .upload(path, buffer, { contentType: "image/png", upsert: false });
      if (!uploadError) {
        const { data } = storage.from("documents").getPublicUrl(path);
        signatureUrl = data.publicUrl;
      }
    } catch (e) {
      console.error("[sitePrepPlan] Signature upload error:", e);
    }
  }

  // ── Upsert plan record ─────────────────────────────────────────────────────
  const existing = await prisma.sitePreparationPlan.findUnique({
    where: { projectId: safetyProjectId },
    select: { id: true },
  });

  if (existing) {
    await prisma.sitePreparationPlan.update({
      where: { id: existing.id },
      data: {
        sections: sections as object[],
        status: "COMPLETE",
        completedAt: signOffAt,
        signOffName: signOffName.trim(),
        signOffAt,
        signatureUrl,
        createdBy: user.id,
      },
    });
  } else {
    await prisma.sitePreparationPlan.create({
      data: {
        projectId: safetyProjectId,
        createdBy: user.id,
        sections: sections as object[],
        status: "COMPLETE",
        completedAt: signOffAt,
        signOffName: signOffName.trim(),
        signOffAt,
        signatureUrl,
      },
    });
  }

  redirect(`/projects/${safetyProjectId}/site-prep`);
}
