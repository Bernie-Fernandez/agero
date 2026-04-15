import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/app/onboarding/onboarding-form";
import { prisma } from "@/lib/prisma";

export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const existing = await prisma.user.findUnique({
    where: { clerkUserId: userId },
  });
  if (existing) {
    redirect("/dashboard");
  }

  // If this Clerk user's email matches a registered subcontractor invitation,
  // link them to the existing org instead of showing the Agero setup form.
  const clerkUser = await currentUser();
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ??
    clerkUser?.emailAddresses[0]?.emailAddress;

  if (email) {
    const invitation = await prisma.invitation.findFirst({
      where: { email, status: "registered" },
      select: { organisationId: true },
    });
    if (invitation?.organisationId) {
      await prisma.user.upsert({
        where: { email },
        create: {
          clerkUserId: userId,
          email,
          name: [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") || null,
          role: "subcontractor_admin",
          organisationId: invitation.organisationId,
        },
        update: { clerkUserId: userId },
      });
      redirect(`/subcontractors/${invitation.organisationId}/documents`);
    }
  }

  return (
    <div className="min-h-full flex-1 bg-zinc-50 px-4 py-16 dark:bg-zinc-950">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Set up your organisation
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          This creates your company in Agero Safety and links your Clerk account as an
          admin. You can invite teammates later.
        </p>
        <OnboardingForm />
      </div>
    </div>
  );
}
