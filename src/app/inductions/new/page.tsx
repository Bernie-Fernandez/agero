import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { InductionBuilder } from "@/app/projects/[id]/induction/induction-builder";
import { saveGenericInduction } from "./actions";

export default async function NewGenericInductionPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const appUser = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (!appUser) redirect("/onboarding");

  const existing = await prisma.inductionTemplate.findFirst({
    where: { type: "generic", isActive: true },
    orderBy: { version: "desc" },
  });

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/inductions" />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-700">← Dashboard</Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Generic induction
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          This induction applies to all workers across all projects. Workers complete it once.
          {existing && ` Current version: v${existing.version}.`}
        </p>

        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <InductionBuilder
            saveAction={saveGenericInduction}
            initialTitle={existing?.title}
            initialQuestions={
              existing
                ? (existing.questions as { question: string; options: string[]; correctAnswer: number }[])
                : undefined
            }
          />
        </div>
      </main>
    </div>
  );
}
