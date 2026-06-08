"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireRole } from "@/lib/auth";

export async function anonymiseWorker(flagId: string): Promise<{ error?: string }> {
  const user = await requireRole(["admin"]);

  const flag = await prisma.retentionFlag.findUnique({
    where: { id: flagId },
    include: { workerAccount: { select: { id: true, mobile: true } } },
  });
  if (!flag?.workerAccount) return { error: "Flag not found" };
  if (flag.resolution !== null) return { error: "Already resolved" };

  const { id: workerAccountId, mobile: originalMobile } = flag.workerAccount;
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

  await prisma.retentionFlag.update({
    where: { id: flagId },
    data: { resolution: "anonymised", resolvedAt: new Date(), resolvedById: user.id },
  });

  revalidatePath("/admin/retention");
  return {};
}

export async function dismissRetentionFlag(flagId: string): Promise<{ error?: string }> {
  const user = await requireRole(["admin"]);

  const flag = await prisma.retentionFlag.findUnique({ where: { id: flagId } });
  if (!flag) return { error: "Flag not found" };
  if (flag.resolution !== null) return { error: "Already resolved" };

  await prisma.retentionFlag.update({
    where: { id: flagId },
    data: { resolution: "dismissed", resolvedAt: new Date(), resolvedById: user.id },
  });

  revalidatePath("/admin/retention");
  return {};
}
