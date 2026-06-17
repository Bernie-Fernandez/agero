"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_MANAGER_ROLES } from "@/lib/auth";
import { sendLegislationUpdateEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/app-url";

export type LegislationState = { error?: string; ok?: boolean };

export async function updateLegislation(
  legId: string,
  _prev: LegislationState,
  formData: FormData,
): Promise<LegislationState> {
  const user = await requireRole(ADMIN_MANAGER_ROLES);

  const leg = await prisma.legislationRegister.findUnique({ where: { id: legId } });
  if (!leg || leg.organisationId !== user.organisationId) return { error: "Not found." };

  const version = (formData.get("version") as string)?.trim();
  if (!version) return { error: "Version is required." };
  const effectiveRaw = formData.get("effectiveDate") as string | null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  const versionChanged = version !== leg.version;

  await prisma.legislationRegister.update({
    where: { id: legId },
    data: {
      version,
      effectiveDate: effectiveRaw ? new Date(effectiveRaw) : leg.effectiveDate,
      lastReviewedDate: new Date(),
      notes,
      updatedByName: user.name ?? user.email,
    },
  });

  // On a version change, flag affected templates and alert Directors.
  if (versionChanged && leg.affectsTemplateKeys.length > 0) {
    const affected = await prisma.wHSDocumentTemplate.findMany({
      where: { organisationId: user.organisationId, templateKey: { in: leg.affectsTemplateKeys } },
      select: { id: true, name: true },
    });
    if (affected.length > 0) {
      await prisma.wHSDocumentTemplate.updateMany({
        where: { id: { in: affected.map((t) => t.id) } },
        data: { flaggedForReview: true, flaggedReason: `Legislative change: ${leg.title} (v${version})` },
      });

      const directors = await prisma.user.findMany({
        where: { organisationId: user.organisationId, role: { in: ["admin", "safety_manager"] } },
        select: { email: true, name: true },
      });
      const reviewUrl = `${getAppUrl()}/admin/annual-review`;
      for (const d of directors) {
        try {
          await sendLegislationUpdateEmail({
            to: d.email,
            adminName: d.name,
            legislationTitle: leg.title,
            newVersion: version,
            affectedTemplates: affected.map((t) => t.name),
            reviewUrl,
          });
        } catch {
          console.error(`[legislation] email failed for ${d.email}`);
        }
      }
    }
  }

  revalidatePath("/admin/legislation");
  revalidatePath("/admin/annual-review");
  return { ok: true };
}
