"use server";

import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const VALID_TYPES = ["SUBCONTRACTOR", "CLIENT", "CONSULTANT", "SUPPLIER"] as const;

// ─── ABN Lookup ──────────────────────────────────────────────────────────────

export async function lookupAbn(rawAbn: string): Promise<{
  ok: boolean;
  error?: string;
  abnStatus?: "ACTIVE" | "CANCELLED";
  abnRegisteredName?: string;
  abnGstRegistered?: boolean;
  asicStatus?: "REGISTERED" | "DEREGISTERED" | "NOT_CHECKED";
}> {
  const abn = rawAbn.replace(/\s/g, "");
  if (!/^\d{11}$/.test(abn)) {
    return { ok: false, error: "ABN must be 11 digits (numbers only)" };
  }

  const guid = process.env.ABN_LOOKUP_GUID;
  if (!guid) {
    return { ok: false, error: "ABN lookup is not configured (missing ABN_LOOKUP_GUID)" };
  }

  try {
    // Layer 1: ABN API (ABR)
    const abnUrl = `https://abr.business.gov.au/json/AbnDetails.aspx?abn=${abn}&callback=callback&guid=${guid}`;
    const abnRes = await fetch(abnUrl, { cache: "no-store" });
    const abnText = await abnRes.text();
    const abnJson = JSON.parse(abnText.replace(/^callback\(/, "").replace(/\)$/, ""));

    if (abnJson.Message) {
      return { ok: false, error: abnJson.Message };
    }

    const abnStatus: "ACTIVE" | "CANCELLED" =
      abnJson.AbnStatus === "Active" ? "ACTIVE" : "CANCELLED";
    const abnRegisteredName: string = abnJson.EntityName || "";
    const abnGstRegistered = !!abnJson.Gst;

    // Layer 2: ASIC (best-effort, no auth required for basic check)
    let asicStatus: "REGISTERED" | "DEREGISTERED" | "NOT_CHECKED" = "NOT_CHECKED";
    try {
      const asicUrl = `https://data.asic.gov.au/api/v2/businessRegistrationDetails?abn=${abn}`;
      const asicRes = await fetch(asicUrl, { cache: "no-store" });
      if (asicRes.ok) {
        const asicJson = await asicRes.json();
        if (asicJson.status === "Registered") asicStatus = "REGISTERED";
        else if (asicJson.status === "Deregistered") asicStatus = "DEREGISTERED";
      }
    } catch {
      // ASIC unavailable — leave as NOT_CHECKED
    }

    return { ok: true, abnStatus, abnRegisteredName, abnGstRegistered, asicStatus };
  } catch {
    return { ok: false, error: "ABN lookup failed — check your connection" };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseAbnFields(formData: FormData) {
  const abnStatus = (formData.get("abnStatus") as string) || "NOT_VERIFIED";
  const abnRegisteredName = (formData.get("abnRegisteredName") as string)?.trim() || null;
  const gstRaw = formData.get("abnGstRegistered") as string | null;
  const abnGstRegistered = gstRaw === "true" ? true : gstRaw === "false" ? false : null;
  const abnVerifiedAt = abnStatus !== "NOT_VERIFIED" ? new Date() : null;
  const asicStatus = (formData.get("asicStatus") as string) || "NOT_CHECKED";
  const asicCheckedAt = asicStatus !== "NOT_CHECKED" ? new Date() : null;
  return { abnStatus, abnRegisteredName, abnGstRegistered, abnVerifiedAt, asicStatus, asicCheckedAt };
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createCompany(formData: FormData) {
  const user = await requireAppUser();

  const name = (formData.get("name") as string)?.trim();
  if (!name) redirect("/crm/companies/new?error=missing-name");

  const legalName = (formData.get("legalName") as string)?.trim() || null;
  const types = (formData.getAll("types") as string[]).filter((t) =>
    VALID_TYPES.includes(t as (typeof VALID_TYPES)[number])
  );
  const abn = (formData.get("abn") as string)?.replace(/\s/g, "") || null;
  const website = (formData.get("website") as string)?.trim() || null;
  const phoneMain = (formData.get("phoneMain") as string)?.trim() || null;
  const emailGeneral = (formData.get("emailGeneral") as string)?.trim() || null;

  const addressStreet = (formData.get("addressStreet") as string)?.trim() || null;
  const addressSuburb = (formData.get("addressSuburb") as string)?.trim() || null;
  const addressState = (formData.get("addressState") as string)?.trim() || null;
  const addressPostcode = (formData.get("addressPostcode") as string)?.trim() || null;

  const postalSameAsStreet = formData.get("postalSameAsStreet") === "true";
  const postalStreet = postalSameAsStreet ? null : ((formData.get("postalStreet") as string)?.trim() || null);
  const postalSuburb = postalSameAsStreet ? null : ((formData.get("postalSuburb") as string)?.trim() || null);
  const postalState = postalSameAsStreet ? null : ((formData.get("postalState") as string)?.trim() || null);
  const postalPostcode = postalSameAsStreet ? null : ((formData.get("postalPostcode") as string)?.trim() || null);

  const paymentTerms = (formData.get("paymentTerms") as string)?.trim() || null;
  const isActive = formData.get("isActive") !== "false";

  const abnFields = parseAbnFields(formData);

  const company = await prisma.company.create({
    data: {
      organisationId: user.organisationId,
      name,
      legalName,
      types,
      abn,
      abnStatus: abnFields.abnStatus as never,
      abnRegisteredName: abnFields.abnRegisteredName,
      abnGstRegistered: abnFields.abnGstRegistered,
      abnVerifiedAt: abnFields.abnVerifiedAt,
      asicStatus: abnFields.asicStatus as never,
      asicCheckedAt: abnFields.asicCheckedAt,
      website,
      phoneMain,
      emailGeneral,
      addressStreet,
      addressSuburb,
      addressState,
      addressPostcode,
      postalSameAsStreet,
      postalStreet,
      postalSuburb,
      postalState,
      postalPostcode,
      paymentTerms,
      isActive,
      dataSource: "MANUAL",
      createdById: user.id,
    },
  });

  // Auto-create SubcontractorProfile when SUBCONTRACTOR type is set
  if (types.includes("SUBCONTRACTOR")) {
    await prisma.subcontractorProfile.create({ data: { companyId: company.id } });
  }

  revalidatePath("/crm/companies");
  redirect(`/crm/companies/${company.id}`);
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updateCompany(id: string, formData: FormData) {
  await requireAppUser();

  const name = (formData.get("name") as string)?.trim();
  if (!name) redirect(`/crm/companies/${id}/edit?error=missing-name`);

  const legalName = (formData.get("legalName") as string)?.trim() || null;
  const types = (formData.getAll("types") as string[]).filter((t) =>
    VALID_TYPES.includes(t as (typeof VALID_TYPES)[number])
  );
  const abn = (formData.get("abn") as string)?.replace(/\s/g, "") || null;
  const website = (formData.get("website") as string)?.trim() || null;
  const phoneMain = (formData.get("phoneMain") as string)?.trim() || null;
  const emailGeneral = (formData.get("emailGeneral") as string)?.trim() || null;

  const addressStreet = (formData.get("addressStreet") as string)?.trim() || null;
  const addressSuburb = (formData.get("addressSuburb") as string)?.trim() || null;
  const addressState = (formData.get("addressState") as string)?.trim() || null;
  const addressPostcode = (formData.get("addressPostcode") as string)?.trim() || null;

  const postalSameAsStreet = formData.get("postalSameAsStreet") === "true";
  const postalStreet = postalSameAsStreet ? null : ((formData.get("postalStreet") as string)?.trim() || null);
  const postalSuburb = postalSameAsStreet ? null : ((formData.get("postalSuburb") as string)?.trim() || null);
  const postalState = postalSameAsStreet ? null : ((formData.get("postalState") as string)?.trim() || null);
  const postalPostcode = postalSameAsStreet ? null : ((formData.get("postalPostcode") as string)?.trim() || null);

  const paymentTerms = (formData.get("paymentTerms") as string)?.trim() || null;
  const isActive = formData.get("isActive") !== "false";

  const abnFields = parseAbnFields(formData);

  // Check if subcontractor profile needs to be created
  const existing = await prisma.company.findUnique({
    where: { id },
    include: { subcontractorProfile: true },
  });

  await prisma.company.update({
    where: { id },
    data: {
      name,
      legalName,
      types,
      abn,
      abnStatus: abnFields.abnStatus as never,
      abnRegisteredName: abnFields.abnRegisteredName,
      abnGstRegistered: abnFields.abnGstRegistered,
      abnVerifiedAt: abnFields.abnVerifiedAt,
      asicStatus: abnFields.asicStatus as never,
      asicCheckedAt: abnFields.asicCheckedAt,
      website,
      phoneMain,
      emailGeneral,
      addressStreet,
      addressSuburb,
      addressState,
      addressPostcode,
      postalSameAsStreet,
      postalStreet,
      postalSuburb,
      postalState,
      postalPostcode,
      paymentTerms,
      isActive,
    },
  });

  if (types.includes("SUBCONTRACTOR") && !existing?.subcontractorProfile) {
    await prisma.subcontractorProfile.create({ data: { companyId: id } });
  }

  revalidatePath("/crm/companies");
  revalidatePath(`/crm/companies/${id}`);
  redirect(`/crm/companies/${id}`);
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export async function deleteCompany(id: string) {
  await requireAppUser();
  await prisma.company.delete({ where: { id } });
  revalidatePath("/crm/companies");
  redirect("/crm/companies");
}
