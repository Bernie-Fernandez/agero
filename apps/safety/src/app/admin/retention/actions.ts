"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireRole } from "@/lib/auth";

// Fields cleared during anonymisation — recorded in the retention audit trail.
const ANONYMISED_FIELDS = [
  "mobile", "firstName", "lastName", "dateOfBirth", "address", "nextOfKin",
  "medicalConditions", "whiteCard", "tradeLicence", "firstAidCert", "trades",
  "certDocuments", "credentialPhotos",
];

function maskMobile(mobile: string): string {
  if (mobile.length <= 7) return "*".repeat(mobile.length);
  return mobile.slice(0, 4) + "*".repeat(mobile.length - 7) + mobile.slice(-3);
}

/** Anonymises a worker account + linked project Worker records, then logs the action. */
async function performAnonymisation(
  workerAccountId: string,
  originalMobile: string,
  performer: { id: string; name: string | null; email: string },
  source: string,
): Promise<void> {
  const anonSuffix = workerAccountId.slice(0, 8);

  await prisma.workerAccount.update({
    where: { id: workerAccountId },
    data: {
      mobile: `ANON_${anonSuffix}`,
      firstName: "Anonymised",
      lastName: "Worker",
      dateOfBirth: null,
      addressStreet: null,
      addressSuburb: null,
      addressState: null,
      addressPostcode: null,
      nokName: null,
      nokRelationship: null,
      nokMobile: null,
      medicalConditions: null,
      whiteCardNumber: null,
      whiteCardExpiry: null,
      tradeLicenceNumber: null,
      tradeLicenceExpiry: null,
      firstAidCertNumber: null,
      firstAidExpiry: null,
      trades: [],
    },
  });

  await prisma.workerCertDocument.deleteMany({ where: { workerAccountId } });
  await prisma.workerSession.deleteMany({ where: { workerAccountId } });

  // Anonymise project-level Worker records linked by mobile (kept for OHS audit trail)
  await prisma.worker.updateMany({
    where: { mobile: originalMobile },
    data: {
      firstName: "Anonymised",
      lastName: "Worker",
      mobile: `ANON_${anonSuffix}`,
      email: null,
      nokName: null,
      nokPhone: null,
      nokRelationship: null,
      whiteCardNo: null,
      whiteCardExpiry: null,
      credentialPhotoUrls: Prisma.DbNull,
    },
  });

  await prisma.dataRetentionLog.create({
    data: {
      workerAccountId,
      subjectLabel: maskMobile(originalMobile),
      action: "ANONYMISED",
      source,
      fieldsCleared: ANONYMISED_FIELDS,
      performedById: performer.id,
      performedByName: performer.name ?? performer.email,
    },
  });
}

export async function anonymiseWorker(flagId: string): Promise<{ error?: string }> {
  const user = await requireRole(["admin"]);

  const flag = await prisma.retentionFlag.findUnique({
    where: { id: flagId },
    include: { workerAccount: { select: { id: true, mobile: true } } },
  });
  if (!flag?.workerAccount) return { error: "Flag not found" };
  if (flag.resolution !== null) return { error: "Already resolved" };

  const { id: workerAccountId, mobile: originalMobile } = flag.workerAccount;

  await performAnonymisation(workerAccountId, originalMobile, user, "MANUAL");

  await prisma.retentionFlag.update({
    where: { id: flagId },
    data: { resolution: "anonymised", resolvedAt: new Date(), resolvedById: user.id },
  });

  revalidatePath("/admin/retention");
  return {};
}

export async function approveDeletionRequest(requestId: string): Promise<{ error?: string }> {
  const user = await requireRole(["admin"]);

  const req = await prisma.dataDeletionRequest.findUnique({
    where: { id: requestId },
    include: { workerAccount: { select: { id: true, mobile: true } } },
  });
  if (!req) return { error: "Request not found" };
  if (req.status !== "PENDING") return { error: "Already resolved" };

  await performAnonymisation(req.workerAccount.id, req.workerAccount.mobile, user, "DELETION_REQUEST");

  // Resolve any open retention flag too
  await prisma.retentionFlag.updateMany({
    where: { workerAccountId: req.workerAccount.id, resolution: null },
    data: { resolution: "anonymised", resolvedAt: new Date(), resolvedById: user.id },
  });

  await prisma.dataDeletionRequest.update({
    where: { id: requestId },
    data: { status: "APPROVED", resolvedAt: new Date(), resolvedById: user.id, resolvedByName: user.name ?? user.email },
  });

  revalidatePath("/admin/retention");
  return {};
}

export async function rejectDeletionRequest(requestId: string): Promise<{ error?: string }> {
  const user = await requireRole(["admin"]);

  const req = await prisma.dataDeletionRequest.findUnique({ where: { id: requestId } });
  if (!req) return { error: "Request not found" };
  if (req.status !== "PENDING") return { error: "Already resolved" };

  await prisma.dataDeletionRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED", resolvedAt: new Date(), resolvedById: user.id, resolvedByName: user.name ?? user.email },
  });

  revalidatePath("/admin/retention");
  return {};
}

export async function dismissRetentionFlag(flagId: string): Promise<{ error?: string }> {
  const user = await requireRole(["admin"]);

  const flag = await prisma.retentionFlag.findUnique({
    where: { id: flagId },
    include: { workerAccount: { select: { id: true, mobile: true } } },
  });
  if (!flag) return { error: "Flag not found" };
  if (flag.resolution !== null) return { error: "Already resolved" };

  await prisma.retentionFlag.update({
    where: { id: flagId },
    data: { resolution: "dismissed", resolvedAt: new Date(), resolvedById: user.id },
  });

  if (flag.workerAccount) {
    await prisma.dataRetentionLog.create({
      data: {
        workerAccountId: flag.workerAccount.id,
        subjectLabel: maskMobile(flag.workerAccount.mobile),
        action: "DISMISSED",
        source: "MANUAL",
        fieldsCleared: [],
        performedById: user.id,
        performedByName: user.name ?? user.email,
      },
    });
  }

  revalidatePath("/admin/retention");
  return {};
}
