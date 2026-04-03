import { auth } from "@clerk/nextjs/server";
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

  return (
    <div className="min-h-full flex-1 bg-zinc-50 px-4 py-16 dark:bg-zinc-950">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Set up your organisation
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          This creates your company in Agero and links your Clerk account as an
          admin. You can invite teammates later.
        </p>
        <OnboardingForm />
      </div>
    </div>
  );
}
