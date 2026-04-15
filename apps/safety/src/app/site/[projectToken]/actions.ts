"use server";

import { prisma } from "@/lib/prisma";
import { createStorageAdminClient } from "@/lib/supabase/server";
import { sendUnknownWorkerAlert } from "@/lib/alerts";
import { getAppUrl } from "@/lib/app-url";
import { redirect } from "next/navigation";

export type SignInState = {
  error?: string;
  requiresInduction?: boolean;
  inductionUrl?: string;
  inductionTitle?: string;
  blockedUntilVerified?: boolean;
};

const workerInclude = {
  documents: true,
  inductionCompletions: { include: { template: true } },
} as const;

const ANNUAL_CYCLE_MS = 365 * 24 * 60 * 60 * 1000;

export async function siteSignIn(
  projectToken: string,
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  try {
    return await doSignIn(projectToken, formData);
  } catch (e) {
    if (typeof e === "object" && e !== null && "digest" in e) throw e;
    console.error("[siteSignIn]", e);
    return { error: "Something went wrong. Please try again." };
  }
}

function hasCurrentCompletion(
  completions: { templateId: string; passed: boolean; signedAt: Date }[],
  templateId: string,
): boolean {
  const cutoff = new Date(Date.now() - ANNUAL_CYCLE_MS);
  return completions.some(
    (c) => c.templateId === templateId && c.passed && c.signedAt > cutoff,
  );
}

async function doSignIn(
  projectToken: string,
  formData: FormData,
): Promise<SignInState> {
  const project = await prisma.project.findUnique({
    where: { token: projectToken },
    include: {
      inductionTemplates: { where: { isActive: true } },
    },
  });

  if (!project) return { error: "Invalid QR code. Please scan again." };

  // ── Path 1: returning from induction (workerId provided) ──────────────────
  const workerIdInput = formData.get("workerId")?.toString();
  if (workerIdInput) {
    const prefilledWorker = await prisma.worker.findUnique({
      where: { id: workerIdInput },
      include: workerInclude,
    });
    if (prefilledWorker && prefilledWorker.projectId === project.id) {
      const photoFile = formData.get("photo");
      return await continueSignIn(
        project,
        prefilledWorker,
        projectToken,
        photoFile instanceof File ? photoFile : null,
      );
    }
  }

  // ── Path 2: session-based (mobile provided by SiteAuthGate) ───────────────
  const mobileInput = formData.get("mobile")?.toString().trim();
  if (mobileInput) {
    const workerAccount = await prisma.workerAccount.findUnique({
      where: { mobile: mobileInput },
    });
    if (!workerAccount) {
      return { error: "Worker account not found. Please sign in again." };
    }

    // Find or create Worker for this project
    let worker = await prisma.worker.findFirst({
      where: { projectId: project.id, mobile: mobileInput },
      include: workerInclude,
    });

    const isUnknown = !worker;
    if (!worker) {
      worker = await prisma.worker.create({
        data: {
          firstName: workerAccount.firstName,
          lastName: workerAccount.lastName,
          mobile: workerAccount.mobile,
          trade: workerAccount.trades[0] ?? null,
          projectId: project.id,
        },
        include: workerInclude,
      });
    }

    // Check if blocked (pending alert)
    if (!isUnknown) {
      const lastVisit = await prisma.siteVisit.findFirst({
        where: { workerId: worker.id, projectId: project.id, isUnknown: true },
        include: { alert: true },
      });
      if (lastVisit && !lastVisit.verified && lastVisit.alert && !lastVisit.alert.verifiedAt) {
        return { blockedUntilVerified: true };
      }
    }

    const photoFile = formData.get("photo");
    return await continueSignIn(
      project,
      worker,
      projectToken,
      photoFile instanceof File ? photoFile : null,
      isUnknown,
    );
  }

  // ── Path 3: legacy name + mobile form (kept for backwards compatibility) ──
  const firstName = formData.get("firstName")?.toString().trim();
  const lastName = formData.get("lastName")?.toString().trim();
  const mobile = formData.get("mobile_legacy")?.toString().trim();

  if (!firstName || !lastName || !mobile) {
    return { error: "Please fill in all fields." };
  }

  const existingWorker = await prisma.worker.findFirst({
    where: {
      projectId: project.id,
      firstName: { equals: firstName, mode: "insensitive" },
      lastName: { equals: lastName, mode: "insensitive" },
      mobile,
    },
    include: workerInclude,
  });

  const isUnknown = !existingWorker;

  if (!isUnknown && existingWorker) {
    const lastVisit = await prisma.siteVisit.findFirst({
      where: { workerId: existingWorker.id, projectId: project.id, isUnknown: true },
      include: { alert: true },
    });
    if (lastVisit && !lastVisit.verified && lastVisit.alert && !lastVisit.alert.verifiedAt) {
      return { blockedUntilVerified: true };
    }
  }

  const worker = isUnknown
    ? await prisma.worker.create({
        data: { firstName, lastName, mobile, projectId: project.id },
        include: workerInclude,
      })
    : existingWorker;

  const photoFile = formData.get("photo");
  return await continueSignIn(
    project,
    worker,
    projectToken,
    photoFile instanceof File ? photoFile : null,
    isUnknown,
  );
}

async function continueSignIn(
  project: Awaited<ReturnType<typeof prisma.project.findUnique>> & {
    inductionTemplates: { id: string; type: string; title: string; isActive: boolean }[];
  },
  worker: {
    id: string;
    firstName: string;
    lastName: string;
    mobile: string | null;
    projectId: string;
    inductionCompletions: { templateId: string; passed: boolean; signedAt: Date; template: { type: string } }[];
    employingOrganisationId?: string | null;
  },
  projectToken: string,
  photoFile: File | null,
  isUnknown = false,
): Promise<SignInState> {
  const host = getAppUrl();
  const returnUrl = `/site/${projectToken}?worker=${worker.id}`;

  // ── SWMS gate ────────────────────────────────────────────────────────────
  // Check if worker's employing org has an approved SWMS for this project
  if (worker.employingOrganisationId) {
    const approvedSwms = await prisma.swmsSubmission.findFirst({
      where: {
        projectId: project.id,
        organisationId: worker.employingOrganisationId,
        status: "approved",
      },
    });
    if (!approvedSwms) {
      return {
        error:
          "Your company's SWMS has not been approved yet. Contact your supervisor.",
      };
    }
  }

  // ── Generic induction check ──────────────────────────────────────────────
  const genericTemplate = project.inductionTemplates.find((t) => t.type === "generic");
  if (!genericTemplate) {
    const globalGeneric = await prisma.inductionTemplate.findFirst({
      where: { type: "generic", isActive: true },
    });
    if (globalGeneric && !hasCurrentCompletion(worker.inductionCompletions, globalGeneric.id)) {
      return {
        requiresInduction: true,
        inductionTitle: globalGeneric.title,
        inductionUrl: `${host}/inductions/${globalGeneric.id}?worker=${worker.id}&next=${encodeURIComponent(returnUrl)}`,
      };
    }
  } else if (!hasCurrentCompletion(worker.inductionCompletions, genericTemplate.id)) {
    return {
      requiresInduction: true,
      inductionTitle: genericTemplate.title,
      inductionUrl: `${host}/inductions/${genericTemplate.id}?worker=${worker.id}&next=${encodeURIComponent(returnUrl)}`,
    };
  }

  // ── Site-specific induction check ────────────────────────────────────────
  const siteTemplate = project.inductionTemplates.find((t) => t.type === "site_specific");
  if (siteTemplate && !hasCurrentCompletion(worker.inductionCompletions, siteTemplate.id)) {
    return {
      requiresInduction: true,
      inductionTitle: siteTemplate.title,
      inductionUrl: `${host}/inductions/${siteTemplate.id}?worker=${worker.id}&next=${encodeURIComponent(returnUrl)}`,
    };
  }

  // ── Upload photo ─────────────────────────────────────────────────────────
  let photoUrl: string | null = null;
  if (photoFile && photoFile.size > 0) {
    try {
      const storage = createStorageAdminClient();
      const path = `site-visits/${project.id}/${worker.id}-${Date.now()}.jpg`;
      const bytes = await photoFile.arrayBuffer();
      const { error } = await storage
        .from("documents")
        .upload(path, bytes, { contentType: photoFile.type || "image/jpeg", upsert: false });
      if (!error) {
        const { data } = storage.from("documents").getPublicUrl(path);
        photoUrl = data.publicUrl;
      }
    } catch {
      // Non-fatal
    }
  }

  // ── Create site visit ────────────────────────────────────────────────────
  const visit = await prisma.siteVisit.create({
    data: {
      workerId: worker.id,
      projectId: project.id,
      photoUrl,
      isUnknown,
      verified: !isUnknown,
    },
  });

  if (isUnknown) {
    await prisma.verificationAlert.create({ data: { siteVisitId: visit.id } });

    const supervisor = await prisma.siteSupervisor.findFirst({
      where: { projectId: project.id },
      include: { worker: true },
    });

    await sendUnknownWorkerAlert({
      workerName: `${worker.firstName} ${worker.lastName}`,
      workerMobile: worker.mobile ?? "",
      projectName: project.name,
      siteVisitId: visit.id,
      supervisorMobile: supervisor?.worker.mobile ?? undefined,
    });
  }

  const params = new URLSearchParams({
    name: `${worker.firstName} ${worker.lastName}`,
    site: project.name,
    time: new Date().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }),
    ...(isUnknown ? { unknown: "1" } : {}),
  });
  redirect(`/site/${projectToken}/confirmed?${params.toString()}`);
}
