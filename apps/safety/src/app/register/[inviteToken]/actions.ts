"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { sendWelcomeEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/app-url";

export type RegisterState = { error?: string };

export async function checkAbn(abn: string): Promise<{
  valid: boolean;
  businessName?: string;
  error?: string;
}> {
  const digits = abn.replace(/\s/g, "");
  if (!/^\d{11}$/.test(digits)) return { valid: false, error: "ABN must be 11 digits." };

  // Checksum validation
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const d = digits.split("").map(Number);
  d[0] -= 1;
  const sum = d.reduce((acc, n, i) => acc + n * weights[i], 0);
  if (sum % 89 !== 0) return { valid: false, error: "ABN checksum is invalid." };

  // ABR lookup (if GUID configured)
  const guid = process.env.ABR_GUID;
  if (guid) {
    try {
      const url = `https://abr.business.gov.au/json/AbnDetails.aspx?abn=${digits}&guid=${guid}`;
      const res = await fetch(url, { next: { revalidate: 0 } });
      const text = await res.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        if (data.AbnStatus === "Active") {
          const name =
            data.EntityName ||
            (data.BusinessName?.[0]?.OrganisationName) ||
            undefined;
          return { valid: true, businessName: name };
        }
        return { valid: false, error: "ABN is not active on the Australian Business Register." };
      }
    } catch {
      // Fall through to checksum-only result
    }
  }

  return { valid: true };
}

export async function completeRegistration(
  inviteToken: string,
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const invitation = await prisma.invitation.findUnique({
    where: { token: inviteToken },
  });

  if (!invitation) return { error: "Invalid registration link." };
  if (invitation.status !== "pending") return { error: "This invitation has already been used or has expired." };
  if (new Date() > invitation.expiresAt) {
    await prisma.invitation.update({ where: { id: invitation.id }, data: { status: "expired" } });
    return { error: "This invitation link has expired. Please ask your head contractor to send a new one." };
  }

  const abn = formData.get("abn")?.toString().replace(/\s/g, "") ?? "";
  const abnCheck = await checkAbn(abn);
  if (!abnCheck.valid) return { error: abnCheck.error ?? "Invalid ABN." };

  const name = formData.get("companyName")?.toString().trim() || invitation.companyName;
  const address = formData.get("address")?.toString().trim() || null;
  const website = formData.get("website")?.toString().trim() || null;
  const tradeCategories = formData.getAll("tradeCategories").map(String);
  if (tradeCategories.length === 0) return { error: "Please select at least one trade category." };

  const org = await prisma.organisation.create({
    data: {
      name,
      abn,
      address,
      website,
      tradeCategories,
      primaryContact: invitation.contactName,
      invitations: { connect: { id: invitation.id } },
    },
  });

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: "registered", organisationId: org.id },
  });

  const host = getAppUrl();
  await sendWelcomeEmail({
    to: invitation.email,
    contactName: invitation.contactName,
    companyName: name,
    documentsUrl: `${host}/subcontractors/${org.id}/documents`,
  });

  const params = new URLSearchParams({ company: name, orgId: org.id });
  redirect(`/register/${inviteToken}/confirmed?${params.toString()}`);
}
