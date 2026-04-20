import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/safety/prisma";
import { AppNav } from "@/components/safety/safety-nav";
import { requireRole, AGERO_ROLES } from "@/lib/safety/auth";
import { SiteInductionBuilder } from "@/app/(safety)/projects/[id]/induction/site-induction-builder";
import { saveInductionTemplate } from "@/app/(safety)/projects/[id]/induction/actions";

export default async function SiteInductionBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const appUser = await requireRole(AGERO_ROLES);

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      inductionTemplates: {
        where: { type: "site_specific", isActive: true },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  if (!project || project.organisationId !== appUser.organisationId) notFound();

  const activeTemplate = project.inductionTemplates[0];
  const nextVersion = activeTemplate ? activeTemplate.version + 1 : 1;

  // Compute the title that will be auto-generated on save — shown as a preview in the builder
  const monthYear = new Date().toLocaleString("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  });
  const nextTitle = `${project.name} — Site Induction v${nextVersion} — ${monthYear}`;

  const saveAction = saveInductionTemplate.bind(null, id);

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/projects" userRole={appUser.role} />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link
          href={`/projects/${id}/induction`}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          ← Site induction overview
        </Link>
        <div className="mt-2">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {activeTemplate ? "Edit site induction" : "Build site induction"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {project.name}
            {activeTemplate && (
              <span className="ml-2 text-zinc-400">
                · Currently v{activeTemplate.version} · Publishing creates v{nextVersion}
              </span>
            )}
          </p>
        </div>

        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <SiteInductionBuilder
            saveAction={saveAction}
            nextTitle={nextTitle}
            initialQuestions={
              activeTemplate ? (activeTemplate.questions as unknown[]) : undefined
            }
            initialVideoUrl={activeTemplate?.videoUrl ?? undefined}
          />
        </div>
      </main>
    </div>
  );
}
