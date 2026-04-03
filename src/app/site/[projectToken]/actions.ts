"use server";

import { prisma } from "@/lib/prisma";
import { createServerClient } from "@/lib/supabase/server";
import { sendUnknownWorkerAlert } from "@/lib/alerts";

export type SignInState = {
  error?: string;
  success?: boolean;
  requiresInduction?: boolean;
  inductionUrl?: string;
  workerId?: string;
  blockedUntilVerified?: boolean;
};

const workerInclude = {
  documents: true,
  inductionCompletions: { include: { template: true } },
} as const;

export async function siteSignIn(
  projectToken: string,
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const project = await prisma.project.findUnique({
    where: { token: projectToken },
    include: {
      inductionTemplates: { where: { isActive: true, type: "site_specific" } },
    },
  });

  if (!project) return { error: "Invalid QR code. Please scan again." };

  const firstName = formData.get("firstName")?.toString().trim();
  const lastName = formData.get("lastName")?.toString().trim();
  const mobile = formData.get("mobile")?.toString().trim();

  if (!firstName || !lastName || !mobile) {
    return { error: "Please fill in all fields." };
  }

  // Look up worker by name + mobile on this project
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
    // Check if previously unverified unknown sign-in is still pending
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

  const host = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Check generic induction
  const genericTemplate = await prisma.inductionTemplate.findFirst({
    where: { type: "generic", isActive: true },
  });

  if (genericTemplate) {
    const genericDone = worker.inductionCompletions.some(
      (c) => c.template.type === "generic" && c.passed,
    );
    if (!genericDone) {
      return {
        requiresInduction: true,
        inductionUrl: `${host}/inductions/${genericTemplate.id}?worker=${worker.id}&next=/site/${projectToken}`,
        workerId: worker.id,
      };
    }
  }

  // Check site induction
  const siteTemplate = project.inductionTemplates[0];
  if (siteTemplate) {
    const siteDone = worker.inductionCompletions.some(
      (c) => c.templateId === siteTemplate.id && c.passed,
    );
    if (!siteDone) {
      return {
        requiresInduction: true,
        inductionUrl: `${host}/inductions/${siteTemplate.id}?worker=${worker.id}&next=/site/${projectToken}`,
        workerId: worker.id,
      };
    }
  }

  // Get photo from formData
  const photoFile = formData.get("photo") as File | null;
  let photoUrl: string | null = null;

  if (photoFile && photoFile.size > 0) {
    const supabase = await createServerClient();
    const path = `site-visits/${project.id}/${worker.id}-${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from("documents")
      .upload(path, photoFile, { upsert: false });

    if (!error) {
      const { data } = supabase.storage.from("documents").getPublicUrl(path);
      photoUrl = data.publicUrl;
    }
  }

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
    await prisma.verificationAlert.create({
      data: { siteVisitId: visit.id },
    });

    const supervisor = await prisma.siteSupervisor.findFirst({
      where: { projectId: project.id },
      include: { worker: true },
    });

    await sendUnknownWorkerAlert({
      workerName: `${firstName} ${lastName}`,
      workerMobile: mobile,
      projectName: project.name,
      siteVisitId: visit.id,
      supervisorMobile: supervisor?.worker.mobile ?? undefined,
    });
  }

  return { success: true };
}
