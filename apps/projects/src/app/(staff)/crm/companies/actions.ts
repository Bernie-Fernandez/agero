"use server";

import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const VALID_TYPES = ["SUBCONTRACTOR", "CLIENT", "CONSULTANT", "SUPPLIER"] as const;

// ─── ABN Lookup helpers ───────────────────────────────────────────────────────

function getGuid(): string | null {
  return process.env.ABN_LOOKUP_GUID ?? null;
}

function parseJsonp(text: string): unknown {
  // Strip JSONP wrapper: callback({...}) or callback([...])
  return JSON.parse(text.replace(/^[^(]+\(/, "").replace(/\)\s*$/, ""));
}

async function asicCheck(abn: string): Promise<"REGISTERED" | "DEREGISTERED" | "NOT_CHECKED"> {
  try {
    const res = await fetch(
      `https://data.asic.gov.au/api/v2/businessRegistrationDetails?abn=${abn}`,
      { cache: "no-store" }
    );
    if (!res.ok) return "NOT_CHECKED";
    const json = await res.json() as { status?: string };
    if (json.status === "Registered") return "REGISTERED";
    if (json.status === "Deregistered") return "DEREGISTERED";
  } catch {
    // ASIC unavailable
  }
  return "NOT_CHECKED";
}

// ─── ABN detail lookup (by ABN number) ───────────────────────────────────────

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

  const guid = getGuid();
  if (!guid) {
    return { ok: false, error: "ABN lookup is not configured — check ABN_LOOKUP_GUID env var" };
  }

  try {
    const url = `https://abr.business.gov.au/json/AbnDetails.aspx?abn=${abn}&callback=callback&guid=${guid}`;
    const res = await fetch(url, { cache: "no-store" });
    const json = parseJsonp(await res.text()) as {
      AbnStatus?: string;
      EntityName?: string;
      Gst?: string | null;
      Message?: string;
    };

    if (json.Message) {
      return { ok: false, error: json.Message };
    }

    const abnStatus: "ACTIVE" | "CANCELLED" = json.AbnStatus === "Active" ? "ACTIVE" : "CANCELLED";
    const abnRegisteredName = json.EntityName ?? "";
    const abnGstRegistered = !!json.Gst;
    const asicStatus = await asicCheck(abn);

    return { ok: true, abnStatus, abnRegisteredName, abnGstRegistered, asicStatus };
  } catch {
    return { ok: false, error: "ABN lookup failed — check your connection" };
  }
}

// ─── Name search (ABR MatchingNames endpoint) ─────────────────────────────────

export interface AbnNameResult {
  abn: string;
  abnStatus: string;
  name: string;
  state: string;
  postcode: string;
}

export async function searchAbnByName(query: string): Promise<{
  ok: boolean;
  error?: string;
  results?: AbnNameResult[];
}> {
  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return { ok: false, error: "Enter at least 3 characters to search" };
  }

  const guid = getGuid();
  if (!guid) {
    return { ok: false, error: "ABN lookup is not configured — check ABN_LOOKUP_GUID env var" };
  }

  try {
    const url = `https://abr.business.gov.au/json/MatchingNames.aspx?name=${encodeURIComponent(trimmed)}&callback=callback&guid=${guid}`;
    const res = await fetch(url, { cache: "no-store" });
    const raw = parseJsonp(await res.text()) as Array<{
      Abn?: string;
      AbnStatus?: string;
      EntityName?: string;
      Name?: string;
      AddressState?: string;
      AddressPostcode?: string;
      Score?: number;
    }>;

    if (!Array.isArray(raw)) {
      return { ok: false, error: "Unexpected response from ABR" };
    }

    const results: AbnNameResult[] = raw
      .filter((r) => r.Abn)
      .slice(0, 20)
      .map((r) => ({
        abn: r.Abn!.replace(/\s/g, ""),
        abnStatus: r.AbnStatus === "Active" ? "ACTIVE" : "CANCELLED",
        name: r.EntityName ?? r.Name ?? "",
        state: r.AddressState ?? "",
        postcode: r.AddressPostcode ?? "",
      }));

    return { ok: true, results };
  } catch {
    return { ok: false, error: "Name search failed — check your connection" };
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
