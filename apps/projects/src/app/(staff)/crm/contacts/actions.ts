"use server";

import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const VALID_STRENGTHS = ["BRONZE", "SILVER", "GOLD"] as const;

// ─── Create Contact ───────────────────────────────────────────────────────────

export async function createContact(formData: FormData) {
  const user = await requireAppUser();

  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  if (!firstName || !lastName) redirect("/crm/contacts/new?error=missing-name");

  const email = (formData.get("email") as string)?.trim() || null;
  const mobile = (formData.get("mobile") as string)?.trim() || null;
  const phoneDdi = (formData.get("phoneDdi") as string)?.trim() || null;
  const jobTitle = (formData.get("jobTitle") as string)?.trim() || null;
  const contactType = (formData.get("contactType") as string)?.trim() || null;
  const contactSubType = (formData.get("contactSubType") as string)?.trim() || null;
  const contactLocation = (formData.get("contactLocation") as string)?.trim() || null;
  const preferredContactMethod = (formData.get("preferredContactMethod") as string)?.trim() || null;
  const doNotCall = formData.get("doNotCall") === "true";
  const mailingAddress = (formData.get("mailingAddress") as string)?.trim() || null;
  const linkedinUrl = (formData.get("linkedinUrl") as string)?.trim() || null;
  const instagramUrl = (formData.get("instagramUrl") as string)?.trim() || null;
  const contactOwnerId = (formData.get("contactOwnerId") as string)?.trim() || null;
  const strengthRaw = (formData.get("contactOwnerStrength") as string)?.trim();
  const contactOwnerStrength = (VALID_STRENGTHS.includes(strengthRaw as (typeof VALID_STRENGTHS)[number]) ? strengthRaw : null) as "BRONZE" | "SILVER" | "GOLD" | null;
  const legalBasisForData = (formData.get("legalBasisForData") as string)?.trim() || null;
  const isActive = formData.get("isActive") !== "false";

  // Company link fields
  const linkCompanyId = (formData.get("linkCompanyId") as string)?.trim() || null;
  const linkPosition = (formData.get("linkPosition") as string)?.trim() || null;
  const linkIsPrimary = formData.get("linkIsPrimary") === "true";

  const contact = await prisma.contact.create({
    data: {
      organisationId: user.organisationId,
      firstName,
      lastName,
      email,
      mobile,
      phoneDdi,
      jobTitle,
      contactType,
      contactSubType,
      contactLocation,
      preferredContactMethod,
      doNotCall,
      mailingAddress,
      linkedinUrl,
      instagramUrl,
      contactOwnerId: contactOwnerId || null,
      contactOwnerStrength,
      legalBasisForData,
      isActive,
      dataSource: "MANUAL",
      createdById: user.id,
    },
  });

  // Link to company if provided
  if (linkCompanyId) {
    await prisma.companyContact.create({
      data: {
        companyId: linkCompanyId,
        contactId: contact.id,
        position: linkPosition || null,
        isPrimary: linkIsPrimary,
        isAccountContact: false,
        isEstimatingContact: false,
      },
    });
  }

  revalidatePath("/crm/contacts");
  if (linkCompanyId) revalidatePath(`/crm/companies/${linkCompanyId}`);

  // If came from company page, redirect back
  const returnTo = (formData.get("returnTo") as string)?.trim();
  if (returnTo) redirect(returnTo);
  redirect(`/crm/contacts/${contact.id}`);
}

// ─── Update Contact ───────────────────────────────────────────────────────────

export async function updateContact(id: string, formData: FormData) {
  await requireAppUser();

  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  if (!firstName || !lastName) redirect(`/crm/contacts/${id}/edit?error=missing-name`);

  const email = (formData.get("email") as string)?.trim() || null;
  const mobile = (formData.get("mobile") as string)?.trim() || null;
  const phoneDdi = (formData.get("phoneDdi") as string)?.trim() || null;
  const jobTitle = (formData.get("jobTitle") as string)?.trim() || null;
  const contactType = (formData.get("contactType") as string)?.trim() || null;
  const contactSubType = (formData.get("contactSubType") as string)?.trim() || null;
  const contactLocation = (formData.get("contactLocation") as string)?.trim() || null;
  const preferredContactMethod = (formData.get("preferredContactMethod") as string)?.trim() || null;
  const doNotCall = formData.get("doNotCall") === "true";
  const mailingAddress = (formData.get("mailingAddress") as string)?.trim() || null;
  const linkedinUrl = (formData.get("linkedinUrl") as string)?.trim() || null;
  const instagramUrl = (formData.get("instagramUrl") as string)?.trim() || null;
  const contactOwnerId = (formData.get("contactOwnerId") as string)?.trim() || null;
  const strengthRaw = (formData.get("contactOwnerStrength") as string)?.trim();
  const contactOwnerStrength = (VALID_STRENGTHS.includes(strengthRaw as (typeof VALID_STRENGTHS)[number]) ? strengthRaw : null) as "BRONZE" | "SILVER" | "GOLD" | null;
  const legalBasisForData = (formData.get("legalBasisForData") as string)?.trim() || null;
  const isActive = formData.get("isActive") !== "false";

  await prisma.contact.update({
    where: { id },
    data: {
      firstName,
      lastName,
      email,
      mobile,
      phoneDdi,
      jobTitle,
      contactType,
      contactSubType,
      contactLocation,
      preferredContactMethod,
      doNotCall,
      mailingAddress,
      linkedinUrl,
      instagramUrl,
      contactOwnerId: contactOwnerId || null,
      contactOwnerStrength,
      legalBasisForData,
      isActive,
    },
  });

  revalidatePath("/crm/contacts");
  revalidatePath(`/crm/contacts/${id}`);
  redirect(`/crm/contacts/${id}`);
}

// ─── Delete Contact ───────────────────────────────────────────────────────────

export async function deleteContact(id: string) {
  await requireAppUser();
  // Get company links for revalidation
  const links = await prisma.companyContact.findMany({ where: { contactId: id }, select: { companyId: true } });
  await prisma.contact.delete({ where: { id } });
  revalidatePath("/crm/contacts");
  for (const link of links) revalidatePath(`/crm/companies/${link.companyId}`);
  redirect("/crm/contacts");
}

// ─── Link Contact to Company ──────────────────────────────────────────────────

export async function linkContactToCompany(
  contactId: string,
  companyId: string,
  position: string | null,
  isPrimary: boolean,
) {
  await requireAppUser();
  await prisma.companyContact.upsert({
    where: { companyId_contactId: { companyId, contactId } },
    create: { companyId, contactId, position, isPrimary, isAccountContact: false, isEstimatingContact: false },
    update: { position, isPrimary },
  });
  revalidatePath(`/crm/contacts/${contactId}`);
  revalidatePath(`/crm/companies/${companyId}`);
}

// ─── Unlink Contact from Company ─────────────────────────────────────────────

export async function unlinkContactFromCompany(contactId: string, companyId: string) {
  await requireAppUser();
  await prisma.companyContact.delete({ where: { companyId_contactId: { companyId, contactId } } });
  revalidatePath(`/crm/contacts/${contactId}`);
  revalidatePath(`/crm/companies/${companyId}`);
}

// ─── Add Note ────────────────────────────────────────────────────────────────

export async function addContactNote(contactId: string, formData: FormData) {
  const user = await requireAppUser();
  const content = (formData.get("content") as string)?.trim();
  if (!content) return;
  await prisma.contactNote.create({
    data: { contactId, content, createdById: user.id },
  });
  revalidatePath(`/crm/contacts/${contactId}`);
}
