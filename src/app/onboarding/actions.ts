"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export type OnboardingState = {
  error?: string;
};

function normaliseAbn(raw: string): string {
  return raw.replace(/\s/g, "");
}

function isValidAbn(abn: string): boolean {
  if (!/^\d{11}$/.test(abn)) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits = abn.split("").map(Number);
  digits[0] -= 1;
  const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0);
  return sum % 89 === 0;
}

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    redirect("/sign-in");
  }

  const existing = await prisma.user.findUnique({
    where: { clerkUserId: userId },
  });
  if (existing) {
    redirect("/dashboard");
  }

  const organisationName = formData.get("organisationName")?.toString().trim();
  if (!organisationName) {
    return { error: "Organisation name is required." };
  }

  const abnRaw = formData.get("abn")?.toString().trim() ?? "";
  let abn: string | null = null;
  if (abnRaw) {
    const normalised = normaliseAbn(abnRaw);
    if (!isValidAbn(normalised)) {
      return { error: "ABN is invalid. Please enter an 11-digit ABN." };
    }
    abn = normalised;
  }

  const tradeCategory = formData.get("tradeCategory")?.toString().trim() || null;
  const primaryContact = formData.get("primaryContact")?.toString().trim() || null;

  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) {
    return {
      error:
        "No email found on your Clerk account. Add an email in your profile and try again.",
    };
  }

  const displayName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    null;

  try {
    await prisma.$transaction(async (tx) => {
      const organisation = await tx.organisation.create({
        data: { name: organisationName, abn, tradeCategory, primaryContact },
      });
      await tx.user.create({
        data: {
          clerkUserId: userId,
          email,
          name: displayName,
          role: "admin",
          organisationId: organisation.id,
        },
      });
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return {
        error:
          "That email is already linked to an Agero account. Sign in instead or use another email.",
      };
    }
    throw e;
  }

  redirect("/dashboard");
}
