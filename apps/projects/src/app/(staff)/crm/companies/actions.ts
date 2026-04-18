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

// Decode XML entities in text content
function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// Extract the first match for a simple element tag within a block of XML text
function xmlText(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
  return m ? decodeXml(m[1].trim()) : "";
}

// Extract the first inner block of an element (for nested elements)
function xmlBlock(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? m[1] : "";
}

// Parse ABR XML MatchingNames response into AbnNameResult[]
function parseAbrXml(xml: string): AbnNameResult[] {
  const results: AbnNameResult[] = [];
  const recordRe = /<searchResultsRecord>([\s\S]*?)<\/searchResultsRecord>/g;
  let match: RegExpExecArray | null;

  while ((match = recordRe.exec(xml)) !== null) {
    const record = match[1];

    // ABN — inside <ABN><identifierValue>
    const abnBlock = xmlBlock(record, "ABN");
    const abn = xmlText(abnBlock, "identifierValue").replace(/\s/g, "");
    if (!abn || !/^\d{11}$/.test(abn)) continue;

    // ABN status
    const rawStatus = xmlText(record, "ABNStatus");
    const abnStatus = rawStatus === "Active" ? "ACTIVE" : "CANCELLED";

    // Entity name — prefer organisationName, fall back to person name parts
    const mainNameBlock = xmlBlock(record, "mainName");
    let name = xmlText(mainNameBlock, "organisationName");
    if (!name) {
      const given = xmlText(mainNameBlock, "personFirstGivenName");
      const family = xmlText(mainNameBlock, "familyName");
      name = [given, family].filter(Boolean).join(" ");
    }
    if (!name) continue;

    // Physical address
    const addrBlock = xmlBlock(record, "mainBusinessPhysicalAddress");
    const state = xmlText(addrBlock, "stateCode");
    const postcode = xmlText(addrBlock, "postcode");

    results.push({ abn, abnStatus, name, state, postcode });
  }

  return results;
}

// Parse ABR JSONP MatchingNames response.
// The API returns: callback({"Names":[{Abn, AbnStatus, Name, State, Postcode}], "Message":""})
function parseAbrJsonp(text: string): AbnNameResult[] | null {
  let parsed: unknown;
  try {
    parsed = parseJsonp(text);
  } catch {
    return null;
  }

  // Response is an object with a Names array (not a bare array)
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as {
      Names?: Array<{
        Abn?: string;
        AbnStatus?: string;
        Name?: string;
        State?: string;
        Postcode?: string;
      }>;
      Message?: string;
    };

    if (obj.Message && !obj.Names?.length) return null; // error message from ABR

    const names = obj.Names ?? [];
    return names
      .filter((r) => r.Abn)
      .map((r) => ({
        abn: r.Abn!.replace(/\s/g, ""),
        abnStatus: r.AbnStatus === "Active" ? "ACTIVE" : "CANCELLED",
        name: r.Name ?? "",
        state: r.State ?? "",
        postcode: r.Postcode ?? "",
      }))
      .filter((r) => r.name);
  }

  // Fallback: bare array (older API behaviour)
  if (Array.isArray(parsed)) {
    return (parsed as Array<{ Abn?: string; AbnStatus?: string; Name?: string; State?: string; Postcode?: string }>)
      .filter((r) => r.Abn && r.Name)
      .map((r) => ({
        abn: r.Abn!.replace(/\s/g, ""),
        abnStatus: r.AbnStatus === "Active" ? "ACTIVE" : "CANCELLED",
        name: r.Name!,
        state: r.State ?? "",
        postcode: r.Postcode ?? "",
      }));
  }

  return null;
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
    const text = await res.text();

    // Detect format: XML responses start with < (some GUIDs return XML)
    const isXml = text.trimStart().startsWith("<");

    let results: AbnNameResult[];
    if (isXml) {
      results = parseAbrXml(text);
    } else {
      const parsed = parseAbrJsonp(text);
      if (parsed === null) {
        // Likely an error message from ABR (invalid GUID etc.)
        try {
          const obj = parseJsonp(text) as { Message?: string };
          if (obj.Message) return { ok: false, error: obj.Message };
        } catch { /* ignore */ }
        return { ok: false, error: "Unexpected response from ABR" };
      }
      results = parsed;
    }

    return { ok: true, results: results.slice(0, 20) };
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
