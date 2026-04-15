"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export type OrgFormState = { error?: string };

export async function createOrganisation(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const appUser = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (!appUser) redirect("/onboarding");

  const name = formData.get("name")?.toString().trim();
  if (!name) return { error: "Company name is required." };

  const abn = formData.get("abn")?.toString().replace(/\s/g, "") || null;
  const tradeCategory = formData.get("tradeCategory")?.toString().trim() || null;
  const primaryContact = formData.get("primaryContact")?.toString().trim() || null;

  await prisma.organisation.create({
    data: { name, abn, tradeCategory, primaryContact },
  });

  redirect("/organisations");
}
