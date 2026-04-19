"use server";

import { prisma } from "@/lib/prisma";
import { requireAppUser, canEdit } from "@/lib/auth";
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

    // ABN status — lives inside the ABN block as <identifierStatus>
    const rawStatus = xmlText(abnBlock, "identifierStatus");
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

  // Supplier profile fields
  const tierRaw = (formData.get("tier") as string)?.trim() || null;
  const tier = (["TIER_1", "TIER_2", "TIER_3"].includes(tierRaw ?? "") ? tierRaw : null) as "TIER_1" | "TIER_2" | "TIER_3" | null;
  const costLevelRaw = (formData.get("costLevel") as string)?.trim() || null;
  const costLevel = (["HIGH", "MID", "LOW"].includes(costLevelRaw ?? "") ? costLevelRaw : null) as "HIGH" | "MID" | "LOW" | null;
  const performanceRatingRaw = (formData.get("performanceRating") as string)?.trim() || null;
  const performanceRating = (["HIGH", "MEDIUM", "LOW", "UNTESTED"].includes(performanceRatingRaw ?? "") ? performanceRatingRaw : null) as "HIGH" | "MEDIUM" | "LOW" | "UNTESTED" | null;
  const isPreferred = formData.get("isPreferred") === "true";
  const tempLabour = formData.get("tempLabour") === "true";
  const expertiseTagIds = formData.getAll("expertiseTagIds") as string[];

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
      tier,
      costLevel,
      performanceRating,
      isPreferred,
      tempLabour,
    },
  });

  // Sync expertise tags: delete all existing, then re-create
  await prisma.companyExpertiseTag.deleteMany({ where: { companyId: id } });
  if (expertiseTagIds.length > 0) {
    await prisma.companyExpertiseTag.createMany({
      data: expertiseTagIds.map((expertiseTagId) => ({ companyId: id, expertiseTagId })),
      skipDuplicates: true,
    });
  }

  if (types.includes("SUBCONTRACTOR") && !existing?.subcontractorProfile) {
    await prisma.subcontractorProfile.create({ data: { companyId: id } });
  }

  revalidatePath("/crm/companies");
  revalidatePath(`/crm/companies/${id}`);
  redirect(`/crm/companies/${id}`);
}

// ─── Blacklist ────────────────────────────────────────────────────────────────

export async function blacklistCompany(id: string, reason: string) {
  const user = await requireAppUser();
  if (!reason?.trim()) return;
  await prisma.company.update({
    where: { id },
    data: {
      isBlacklisted: true,
      blacklistReason: reason.trim(),
      blacklistedAt: new Date(),
      blacklistedById: user.id,
    },
  });
  revalidatePath(`/crm/companies/${id}`);
  revalidatePath("/crm/companies");
}

export async function unblacklistCompany(id: string) {
  await requireAppUser();
  await prisma.company.update({
    where: { id },
    data: {
      isBlacklisted: false,
      blacklistReason: null,
      blacklistedAt: null,
      blacklistedById: null,
    },
  });
  revalidatePath(`/crm/companies/${id}`);
  revalidatePath("/crm/companies");
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export async function deleteCompany(id: string) {
  const user = await requireAppUser();
  if (user.role !== "DIRECTOR") redirect("/unauthorized");
  await prisma.company.delete({ where: { id } });
  revalidatePath("/crm/companies");
  redirect("/crm/companies");
}

// ─── Delete Company with orphaned contacts ────────────────────────────────────

export async function deleteCompanyWithContacts(id: string) {
  const user = await requireAppUser();
  if (user.role !== "DIRECTOR") redirect("/unauthorized");

  // Capture contact IDs before cascade delete
  const links = await prisma.companyContact.findMany({
    where: { companyId: id },
    select: { contactId: true },
  });
  const contactIds = links.map((l) => l.contactId);

  // Delete company (cascades CompanyContact records)
  await prisma.company.delete({ where: { id } });

  // Delete contacts that now have no remaining company links
  for (const contactId of contactIds) {
    const remaining = await prisma.companyContact.count({ where: { contactId } });
    if (remaining === 0) {
      await prisma.contact.deleteMany({ where: { id: contactId } });
    }
  }

  revalidatePath("/crm/companies");
  revalidatePath("/crm/contacts");
  redirect("/crm/companies");
}

// ─── Company Contact Link ─────────────────────────────────────────────────────

export async function addCompanyContactLink(companyId: string, formData: FormData) {
  const user = await requireAppUser();
  const { canEdit } = await import("@/lib/auth");
  if (!canEdit(user.role)) redirect("/unauthorized");

  const contactId = (formData.get("contactId") as string)?.trim();
  if (!contactId) return;
  const position = (formData.get("position") as string)?.trim() || null;
  const isPrimary = formData.get("isPrimary") === "true";
  const isAccountContact = formData.get("isAccountContact") === "on" || formData.get("isAccountContact") === "true";
  const isEstimatingContact = formData.get("isEstimatingContact") === "on" || formData.get("isEstimatingContact") === "true";
  const associationLabelId = (formData.get("associationLabelId") as string)?.trim() || null;

  await prisma.companyContact.upsert({
    where: { companyId_contactId: { companyId, contactId } },
    create: { companyId, contactId, position, isPrimary, isAccountContact, isEstimatingContact, associationLabelId },
    update: { position, isPrimary, isAccountContact, isEstimatingContact, associationLabelId },
  });

  revalidatePath(`/crm/companies/${companyId}`);
  revalidatePath(`/crm/contacts/${contactId}`);
}

export async function removeCompanyContactLink(companyId: string, contactId: string) {
  const user = await requireAppUser();
  if (user.role !== "DIRECTOR") redirect("/unauthorized");
  await prisma.companyContact.delete({ where: { companyId_contactId: { companyId, contactId } } });
  revalidatePath(`/crm/companies/${companyId}`);
  revalidatePath(`/crm/contacts/${contactId}`);
}

export async function updateCompanyContactLink(ccId: string, companyId: string, formData: FormData) {
  const user = await requireAppUser();
  const { canEdit } = await import("@/lib/auth");
  if (!canEdit(user.role)) redirect("/unauthorized");

  const position = (formData.get("position") as string)?.trim() || null;
  const isPrimary = formData.get("isPrimary") === "true";
  const isAccountContact = formData.get("isAccountContact") === "on" || formData.get("isAccountContact") === "true";
  const isEstimatingContact = formData.get("isEstimatingContact") === "on" || formData.get("isEstimatingContact") === "true";
  const associationLabelId = (formData.get("associationLabelId") as string)?.trim() || null;

  await prisma.companyContact.update({
    where: { id: ccId },
    data: { position, isPrimary, isAccountContact, isEstimatingContact, associationLabelId },
  });

  revalidatePath(`/crm/companies/${companyId}`);
  redirect(`/crm/companies/${companyId}`);
}

// ─── Wizard: Retrieve Company Data ───────────────────────────────────────────

export interface WizardDirector {
  fullName: string;
  firstName: string;
  lastName: string;
  appointmentDate: string | null;
}

export interface RetrievedCompanyData {
  abn: string;
  // ABR
  abnStatus: "ACTIVE" | "CANCELLED";
  abnRegisteredName: string;
  abnTradingName: string | null;
  abnRegisteredDate: string | null;
  abnEntityType: string | null;
  anzsicCode: string | null;
  abnGstRegistered: boolean;
  gstRegisteredDate: string | null;
  // ASIC
  asicStatus: "REGISTERED" | "DEREGISTERED" | "NOT_CHECKED";
  asicRegisteredDate: string | null;
  asicRegisteredAddress: string | null;
  asicDirectors: WizardDirector[];
  asicPreviousNames: string[];
  // Insolvency
  insolvencyCheckResult: "CLEAR" | "CONCERNS" | "NOT_CHECKED";
  insolvencyCheckSummary: string;
}

async function fetchAbrExtended(abn: string, guid: string) {
  const url = `https://abr.business.gov.au/json/AbnDetails.aspx?abn=${abn}&callback=callback&guid=${guid}`;
  const res = await fetch(url, { cache: "no-store" });
  const json = parseJsonp(await res.text()) as {
    AbnStatus?: string;
    AbnStatusFromDate?: string;
    EntityName?: string;
    EntityTypeName?: string;
    Gst?: string | null;
    Message?: string;
    MainTradingEntityIndustryClass?: { IndustryCode?: string };
    BusinessName?: Array<{ OrganisationName?: string; IsCurrentIndicator?: string }>;
  };
  if (json.Message) throw new Error(json.Message);
  // Extract current trading name from BusinessName array (registered before May 2012)
  const currentTradingName =
    json.BusinessName?.find((b) => b.IsCurrentIndicator === "Y")?.OrganisationName ?? null;
  return {
    abnStatus: (json.AbnStatus === "Active" ? "ACTIVE" : "CANCELLED") as "ACTIVE" | "CANCELLED",
    abnRegisteredName: json.EntityName ?? "",
    abnTradingName: currentTradingName,
    abnRegisteredDate: json.AbnStatusFromDate ?? null,
    abnEntityType: json.EntityTypeName ?? null,
    anzsicCode: json.MainTradingEntityIndustryClass?.IndustryCode ?? null,
    abnGstRegistered: !!json.Gst,
    gstRegisteredDate: typeof json.Gst === "string" ? json.Gst : null,
  };
}

function parseDirectorName(fullName: string): { firstName: string; lastName: string } {
  // ASIC usually returns "LASTNAME FIRSTNAME MIDDLE" in all caps
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: "", lastName: parts[0] };
  const lastName = parts[0];
  const firstName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

async function fetchAsicDetails(abn: string) {
  try {
    const res = await fetch(
      `https://data.asic.gov.au/api/v2/businessRegistrationDetails?abn=${abn}`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const json = await res.json() as {
      status?: string;
      registrationDate?: string;
      registeredAddress?: string;
      directors?: Array<{ fullName?: string; appointmentDate?: string }>;
      previousNames?: string[];
    };
    const directors: WizardDirector[] = (json.directors ?? []).map((d) => {
      const full = d.fullName ?? "";
      const { firstName, lastName } = parseDirectorName(full);
      return { fullName: full, firstName, lastName, appointmentDate: d.appointmentDate ?? null };
    });
    return {
      status: json.status === "Registered" ? "REGISTERED" as const
            : json.status === "Deregistered" ? "DEREGISTERED" as const
            : "NOT_CHECKED" as const,
      registeredDate: json.registrationDate ?? null,
      registeredAddress: json.registeredAddress ?? null,
      directors,
      previousNames: json.previousNames ?? [],
    };
  } catch {
    return null;
  }
}

async function checkInsolvency(abn: string, entityName: string): Promise<{
  result: "CLEAR" | "CONCERNS" | "NOT_CHECKED";
  summary: string;
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { result: "NOT_CHECKED", summary: "Insolvency check not configured (missing ANTHROPIC_API_KEY)." };

  // Fetch ASIC insolvency notices (best-effort)
  let asicSnippet = "";
  try {
    const r = await fetch(
      `https://insolvencynotices.asic.gov.au/results?q=${encodeURIComponent(abn)}`,
      { cache: "no-store", signal: AbortSignal.timeout(6000) }
    );
    if (r.ok) {
      const html = await r.text();
      asicSnippet = html.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").substring(0, 2000);
    }
  } catch { /* ignore */ }

  // Fetch AFSA bankruptcy register (best-effort)
  let afsaSnippet = "";
  try {
    const r = await fetch(
      `https://www.afsa.gov.au/insolvency/insolvency-register/search?q=${encodeURIComponent(entityName)}`,
      { cache: "no-store", signal: AbortSignal.timeout(6000) }
    );
    if (r.ok) {
      const html = await r.text();
      afsaSnippet = html.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").substring(0, 2000);
    }
  } catch { /* ignore */ }

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 256,
        messages: [
          {
            role: "user",
            content: `You are checking Australian insolvency/administration/bankruptcy status for:
Company: "${entityName}"
ABN: ${abn}

ASIC Insolvency Notices page content:
${asicSnippet || "(could not retrieve)"}

AFSA Bankruptcy Register page content:
${afsaSnippet || "(could not retrieve)"}

Analyse and respond with JSON only — no other text:
{"riskLevel":"CLEAR"|"CONCERNS","summary":"1-2 sentence plain English result"}

Use CONCERNS only if there is a specific insolvency/administration/bankruptcy record for this exact entity. If data could not be retrieved, say so in the summary and use CLEAR.`,
          },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await resp.json() as { content?: Array<{ text?: string }> };
    const raw = data.content?.[0]?.text ?? "{}";
    const clean = raw.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(clean) as { riskLevel?: string; summary?: string };
    return {
      result: parsed.riskLevel === "CONCERNS" ? "CONCERNS" : "CLEAR",
      summary: parsed.summary ?? "No insolvency notices found.",
    };
  } catch {
    return {
      result: "NOT_CHECKED",
      summary: "Insolvency check could not be completed — please verify manually.",
    };
  }
}

export async function retrieveCompanyData(abn: string, entityName: string): Promise<{
  ok: boolean;
  error?: string;
  data?: RetrievedCompanyData;
}> {
  const cleanAbn = abn.replace(/\s/g, "");
  if (!/^\d{11}$/.test(cleanAbn)) return { ok: false, error: "Invalid ABN" };
  const guid = getGuid();
  if (!guid) return { ok: false, error: "ABN lookup not configured — check ABN_LOOKUP_GUID env var" };

  const [abnResult, asicResult, insolvencyResult] = await Promise.allSettled([
    fetchAbrExtended(cleanAbn, guid),
    fetchAsicDetails(cleanAbn),
    checkInsolvency(cleanAbn, entityName),
  ]);

  if (abnResult.status === "rejected") {
    return { ok: false, error: String(abnResult.reason) };
  }

  const abnData = abnResult.value;
  const asicData = asicResult.status === "fulfilled" ? asicResult.value : null;
  const insolvencyData = insolvencyResult.status === "fulfilled" ? insolvencyResult.value : null;

  return {
    ok: true,
    data: {
      abn: cleanAbn,
      abnStatus: abnData.abnStatus,
      abnRegisteredName: abnData.abnRegisteredName,
      abnTradingName: abnData.abnTradingName,
      abnRegisteredDate: abnData.abnRegisteredDate,
      abnEntityType: abnData.abnEntityType,
      anzsicCode: abnData.anzsicCode,
      abnGstRegistered: abnData.abnGstRegistered,
      gstRegisteredDate: abnData.gstRegisteredDate,
      asicStatus: asicData?.status ?? "NOT_CHECKED",
      asicRegisteredDate: asicData?.registeredDate ?? null,
      asicRegisteredAddress: asicData?.registeredAddress ?? null,
      asicDirectors: asicData?.directors ?? [],
      asicPreviousNames: asicData?.previousNames ?? [],
      insolvencyCheckResult: insolvencyData?.result ?? "NOT_CHECKED",
      insolvencyCheckSummary: insolvencyData?.summary ?? "Check not completed.",
    },
  };
}

// ─── Wizard: Create Company From Wizard ──────────────────────────────────────

export interface WizardCompanyInput {
  // identity
  tradingName: string;
  types: string[];
  // from retrieval
  retrieved: RetrievedCompanyData;
  // user-confirmed addresses
  asicRegisteredAddress: string;
  tradingAddressStreet: string;
  tradingAddressSuburb: string;
  tradingAddressState: string;
  tradingAddressPostcode: string;
  // postal address
  postalSameAsTrading: boolean;
  postalStreet: string;
  postalSuburb: string;
  postalState: string;
  postalPostcode: string;
  // optional
  paymentTerms?: string;
  // supplier profile (optional)
  tier?: string;
  costLevel?: string;
  performanceRating?: string;
  isPreferred?: boolean;
  tempLabour?: boolean;
}

export async function createCompanyFromWizard(
  input: WizardCompanyInput,
  directorsToAdd: WizardDirector[]
): Promise<{ companyId: string }> {
  const user = await requireAppUser();
  const r = input.retrieved;

  const now = new Date();
  const toDate = (s: string | null | undefined) =>
    s ? new Date(s) : null;

  const company = await prisma.company.create({
    data: {
      organisationId: user.organisationId,
      name: input.tradingName,
      legalName: r.abnRegisteredName || null,
      types: input.types,
      abn: r.abn,
      abnStatus: r.abnStatus as never,
      abnRegisteredName: r.abnRegisteredName || null,
      abnGstRegistered: r.abnGstRegistered,
      abnRegisteredDate: toDate(r.abnRegisteredDate),
      abnEntityType: r.abnEntityType,
      anzsicCode: r.anzsicCode,
      gstRegisteredDate: toDate(r.gstRegisteredDate),
      abnVerifiedAt: now,
      asicStatus: r.asicStatus as never,
      asicCheckedAt: now,
      asicRegisteredDate: toDate(r.asicRegisteredDate),
      asicRegisteredAddress: input.asicRegisteredAddress || null,
      insolvencyCheckResult: r.insolvencyCheckResult,
      insolvencyCheckSummary: r.insolvencyCheckSummary,
      insolvencyCheckedAt: now,
      addressStreet: input.tradingAddressStreet || null,
      addressSuburb: input.tradingAddressSuburb || null,
      addressState: input.tradingAddressState || null,
      addressPostcode: input.tradingAddressPostcode || null,
      postalSameAsStreet: input.postalSameAsTrading,
      postalStreet: input.postalSameAsTrading ? null : (input.postalStreet || null),
      postalSuburb: input.postalSameAsTrading ? null : (input.postalSuburb || null),
      postalState: input.postalSameAsTrading ? null : (input.postalState || null),
      postalPostcode: input.postalSameAsTrading ? null : (input.postalPostcode || null),
      paymentTerms: input.paymentTerms || null,
      isActive: true,
      dataSource: "API",
      createdById: user.id,
      tier: (["TIER_1", "TIER_2", "TIER_3"].includes(input.tier ?? "") ? input.tier : null) as "TIER_1" | "TIER_2" | "TIER_3" | null,
      costLevel: (["HIGH", "MID", "LOW"].includes(input.costLevel ?? "") ? input.costLevel : null) as "HIGH" | "MID" | "LOW" | null,
      performanceRating: (["HIGH", "MEDIUM", "LOW", "UNTESTED"].includes(input.performanceRating ?? "") ? input.performanceRating : null) as "HIGH" | "MEDIUM" | "LOW" | "UNTESTED" | null,
      isPreferred: input.isPreferred ?? false,
      tempLabour: input.tempLabour ?? false,
    },
  });

  // Auto-create SubcontractorProfile
  if (input.types.includes("SUBCONTRACTOR")) {
    await prisma.subcontractorProfile.create({ data: { companyId: company.id } });
  }

  // Create director contacts
  for (const dir of directorsToAdd) {
    const contact = await prisma.contact.create({
      data: {
        organisationId: user.organisationId,
        firstName: dir.firstName || dir.fullName,
        lastName: dir.lastName || "",
        jobTitle: "Director",
        dataSource: "API",
        createdById: user.id,
      },
    });
    await prisma.companyContact.create({
      data: {
        companyId: company.id,
        contactId: contact.id,
        position: "Director",
        isPrimary: false,
      },
    });
  }

  revalidatePath("/crm/companies");
  return { companyId: company.id };
}

// ─── Inline Create Contact + Link ─────────────────────────────────────────────

export async function createContactInline(
  companyId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAppUser();
  if (!canEdit(user.role)) return { ok: false, error: "Unauthorized" };

  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  if (!firstName || !lastName) return { ok: false, error: "First and last name are required." };

  const email = (formData.get("email") as string)?.trim() || null;
  const mobile = (formData.get("mobile") as string)?.trim() || null;
  const phoneDdi = (formData.get("phoneDdi") as string)?.trim() || null;
  if (!email && !mobile && !phoneDdi)
    return { ok: false, error: "At least one of email, mobile, or DDI is required." };

  const jobTitle = (formData.get("jobTitle") as string)?.trim() || null;
  const isAccountContact = formData.get("isAccountContact") === "true";
  const isEstimatingContact = formData.get("isEstimatingContact") === "true";
  const associationLabelId = (formData.get("associationLabelId") as string)?.trim() || null;

  try {
    const contact = await prisma.contact.create({
      data: {
        organisationId: user.organisationId,
        firstName,
        lastName,
        email,
        mobile,
        phoneDdi,
        jobTitle,
        contactCategory: "OPERATIONAL",
        isActive: true,
        dataSource: "MANUAL",
        createdById: user.id,
      },
    });

    await prisma.companyContact.create({
      data: {
        companyId,
        contactId: contact.id,
        position: jobTitle,
        isPrimary: false,
        isAccountContact,
        isEstimatingContact,
        associationLabelId,
      },
    });

    revalidatePath(`/crm/companies/${companyId}`);
    revalidatePath("/crm/contacts");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to create contact. Please try again." };
  }
}
