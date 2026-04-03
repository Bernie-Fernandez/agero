import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { InductionBuilder } from "./induction-builder";
import { SwmsUploadForm } from "./swms-upload-form";
import { saveInductionTemplate, uploadSwms } from "./actions";
import { DocumentType } from "@/generated/prisma/client";

export default async function SiteInductionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const appUser = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (!appUser) redirect("/onboarding");

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      inductionTemplates: {
        where: { type: "site_specific" },
        orderBy: { version: "desc" },
      },
      documents: { where: { type: DocumentType.swms } },
    },
  });

  if (!project || project.organisationId !== appUser.organisationId) notFound();

  const activeTemplate = project.inductionTemplates.find((t) => t.isActive);
  const swms = project.documents[0];

  const saveAction = saveInductionTemplate.bind(null, id);
  const swmsAction = uploadSwms.bind(null, id);

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/projects" />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link href={`/projects/${id}`} className="text-sm text-zinc-500 hover:text-zinc-700">
          ← Back to project
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Site induction — {project.name}
        </h1>
        {activeTemplate && (
          <p className="mt-1 text-sm text-zinc-500">
            Active version: v{activeTemplate.version} · {project.inductionTemplates.length} version(s) total
          </p>
        )}

        <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">
            SWMS upload
          </h2>
          <SwmsUploadForm uploadAction={swmsAction} currentUrl={swms?.url} />
        </div>

        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">
            {activeTemplate ? "Edit induction questionnaire" : "Build induction questionnaire"}
          </h2>
          <InductionBuilder
            saveAction={saveAction}
            initialTitle={activeTemplate?.title}
            initialQuestions={
              activeTemplate
                ? (activeTemplate.questions as { question: string; options: string[]; correctAnswer: number }[])
                : undefined
            }
          />
        </div>
      </main>
    </div>
  );
}
