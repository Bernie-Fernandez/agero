"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { createStorageAdminClient } from "@/lib/supabase/server";
import { reviewSwms } from "@/lib/claude";
import { sendSwmsRejectedEmail, sendSwmsApprovedEmail } from "@/lib/email";

export type SwmsUploadState = { error?: string; success?: boolean };
export type SwmsReviewState = { error?: string };

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

export async function uploadSwmsForReview(
  projectId: string,
  orgId: string,
  _prev: SwmsUploadState,
  formData: FormData,
): Promise<SwmsUploadState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Please select a PDF file." };
  if (file.size > MAX_SIZE) return { error: "File must be under 50 MB." };
  if (!file.name.toLowerCase().endsWith(".pdf")) return { error: "Only PDF files are accepted for SWMS." };

  const storage = createStorageAdminClient();
  const bytes = await file.arrayBuffer();
  const path = `swms/${projectId}/${orgId}-${Date.now()}.pdf`;

  const { error: storageError } = await storage
    .from("documents")
    .upload(path, bytes, { contentType: "application/pdf", upsert: false });

  if (storageError) return { error: `Upload failed: ${storageError.message}` };

  const { data: urlData } = storage.from("documents").getPublicUrl(path);

  // Determine version number
  const lastSubmission = await prisma.swmsSubmission.findFirst({
    where: { projectId, organisationId: orgId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });
  const versionNumber = (lastSubmission?.versionNumber ?? 0) + 1;

  // Create submission record first (status: pending_review)
  const submission = await prisma.swmsSubmission.create({
    data: {
      projectId,
      organisationId: orgId,
      fileUrl: urlData.publicUrl,
      versionNumber,
    },
  });

  // Run AI review if API key is configured
  if (process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.includes("YOUR_KEY")) {
    try {
      const base64 = Buffer.from(bytes).toString("base64");
      const aiResult = await reviewSwms(base64);
      await prisma.swmsSubmission.update({
        where: { id: submission.id },
        data: {
          aiScanResults: aiResult as object,
          aiRecommendation: aiResult.overall_recommendation,
        },
      });
    } catch (e) {
      console.error("[SWMS AI review]", e);
      // Non-fatal — submission saved without AI results
    }
  }

  redirect(`/projects/${projectId}/subcontractors/${orgId}/swms`);
}

export async function approveSwms(
  submissionId: string,
  projectId: string,
  orgId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prev: SwmsReviewState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<SwmsReviewState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const appUser = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { name: true, email: true },
  });

  await prisma.swmsSubmission.update({
    where: { id: submissionId },
    data: {
      status: "approved",
      reviewedBy: appUser?.name ?? appUser?.email ?? "Safety Manager",
      reviewedAt: new Date(),
    },
  });

  // Notify subcontractor
  const org = await prisma.organisation.findUnique({ where: { id: orgId } });
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  const inv = await prisma.invitation.findFirst({ where: { organisationId: orgId } });

  if (inv && org && project) {
    await sendSwmsApprovedEmail({
      to: inv.email,
      contactName: inv.contactName,
      companyName: org.name,
      projectName: project.name,
    });
  }

  redirect(`/projects/${projectId}/subcontractors/${orgId}/swms`);
}

export async function rejectSwms(
  submissionId: string,
  projectId: string,
  orgId: string,
  _prev: SwmsReviewState,
  formData: FormData,
): Promise<SwmsReviewState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const comments = formData.get("comments")?.toString().trim();
  if (!comments) return { error: "Please enter rejection comments for the subcontractor." };

  const appUser = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { name: true, email: true },
  });

  await prisma.swmsSubmission.update({
    where: { id: submissionId },
    data: {
      status: "rejected",
      reviewedBy: appUser?.name ?? appUser?.email ?? "Safety Manager",
      reviewedAt: new Date(),
      reviewerComments: comments,
    },
  });

  const org = await prisma.organisation.findUnique({ where: { id: orgId } });
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  const inv = await prisma.invitation.findFirst({ where: { organisationId: orgId } });
  const host = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (inv && org && project) {
    await sendSwmsRejectedEmail({
      to: inv.email,
      contactName: inv.contactName,
      companyName: org.name,
      projectName: project.name,
      reviewerComments: comments,
      resubmitUrl: `${host}/projects/${projectId}/subcontractors/${orgId}/swms`,
    });
  }

  redirect(`/projects/${projectId}/subcontractors/${orgId}/swms`);
}
