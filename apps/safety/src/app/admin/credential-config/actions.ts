"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { DEFAULT_CREDENTIAL_CONFIG, ALL_CREDENTIAL_TYPES } from "@/lib/credential-config";

export type SaveConfigState = { error?: string; success?: string };

export async function saveCredentialConfig(
  _prev: SaveConfigState,
  fd: FormData,
): Promise<SaveConfigState> {
  const user = await requireRole(["admin"]);

  // Identity types: which are acceptable
  const allIdentityValues = ["driver_licence", "passport", "government_id"];
  const acceptableIdentityTypes = allIdentityValues.filter(
    (v) => fd.get(`identity_${v}`) === "on",
  );
  if (acceptableIdentityTypes.length === 0) {
    return { error: "At least one identity document type must be acceptable." };
  }

  // Expiry required types
  const allTypeValues = ALL_CREDENTIAL_TYPES.map((t) => t.value);
  const expiryRequiredTypes = allTypeValues.filter(
    (v) => fd.get(`expiry_${v}`) === "on",
  );

  // Thresholds
  const warnRaw = parseInt(fd.get("expiryWarnDays")?.toString() ?? "30", 10);
  const urgentRaw = parseInt(fd.get("expiryUrgentDays")?.toString() ?? "7", 10);

  const expiryWarnDays = isNaN(warnRaw) || warnRaw < 1 ? DEFAULT_CREDENTIAL_CONFIG.expiryWarnDays : warnRaw;
  const expiryUrgentDays = isNaN(urgentRaw) || urgentRaw < 1 ? DEFAULT_CREDENTIAL_CONFIG.expiryUrgentDays : urgentRaw;

  if (expiryUrgentDays >= expiryWarnDays) {
    return { error: "Urgent threshold must be fewer days than the warning threshold." };
  }

  await prisma.credentialConfig.upsert({
    where: { organisationId: user.organisationId },
    create: {
      organisationId: user.organisationId,
      acceptableIdentityTypes,
      expiryRequiredTypes,
      expiryWarnDays,
      expiryUrgentDays,
    },
    update: {
      acceptableIdentityTypes,
      expiryRequiredTypes,
      expiryWarnDays,
      expiryUrgentDays,
    },
  });

  revalidatePath("/admin/credential-config");
  revalidatePath("/worker/profile");
  return { success: "Settings saved." };
}

export async function resetCredentialConfig(_formData: FormData): Promise<void> {
  const user = await requireRole(["admin"]);

  await prisma.credentialConfig.upsert({
    where: { organisationId: user.organisationId },
    create: {
      organisationId: user.organisationId,
      acceptableIdentityTypes: DEFAULT_CREDENTIAL_CONFIG.acceptableIdentityTypes,
      expiryRequiredTypes: DEFAULT_CREDENTIAL_CONFIG.expiryRequiredTypes,
      expiryWarnDays: DEFAULT_CREDENTIAL_CONFIG.expiryWarnDays,
      expiryUrgentDays: DEFAULT_CREDENTIAL_CONFIG.expiryUrgentDays,
    },
    update: {
      acceptableIdentityTypes: DEFAULT_CREDENTIAL_CONFIG.acceptableIdentityTypes,
      expiryRequiredTypes: DEFAULT_CREDENTIAL_CONFIG.expiryRequiredTypes,
      expiryWarnDays: DEFAULT_CREDENTIAL_CONFIG.expiryWarnDays,
      expiryUrgentDays: DEFAULT_CREDENTIAL_CONFIG.expiryUrgentDays,
    },
  });

  revalidatePath("/admin/credential-config");
  revalidatePath("/worker/profile");
  redirect("/admin/credential-config");
}
