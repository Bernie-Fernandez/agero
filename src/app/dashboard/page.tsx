import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const appUser = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    include: { organisation: true },
  });

  if (!appUser) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            Agero
          </Link>
          <UserButton />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Dashboard
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Signed in as{" "}
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {appUser.email}
          </span>
        </p>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          Organisation:{" "}
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {appUser.organisation.name}
          </span>
        </p>
      </main>
    </div>
  );
}
