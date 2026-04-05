import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SignInForm } from "./sign-in-form";
import { siteSignIn } from "./actions";

export default async function SiteSignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectToken: string }>;
  searchParams: Promise<{ worker?: string }>;
}) {
  const { projectToken } = await params;
  const { worker: workerIdParam } = await searchParams;

  const project = await prisma.project.findUnique({
    where: { token: projectToken },
    include: {
      inductionTemplates: { where: { isActive: true }, orderBy: { type: "asc" } },
    },
  });

  if (!project) notFound();

  // Also check global generic induction template
  const globalGeneric = await prisma.inductionTemplate.findFirst({
    where: { type: "generic", isActive: true },
    select: { id: true, title: true },
  });

  // Build requirements list for upfront display
  type InductionRequirement = { id: string; title: string; type: string };
  const inductionRequirements: InductionRequirement[] = [];
  if (globalGeneric) {
    inductionRequirements.push({ id: globalGeneric.id, title: globalGeneric.title, type: "generic" });
  }
  const siteTemplate = project.inductionTemplates.find((t) => t.type === "site_specific");
  if (siteTemplate) {
    inductionRequirements.push({ id: siteTemplate.id, title: siteTemplate.title, type: "site_specific" });
  }

  // Pre-fill from ?worker= (returning after completing induction)
  let workerPrefill: { id: string; firstName: string; lastName: string } | null = null;
  if (workerIdParam) {
    const worker = await prisma.worker.findUnique({
      where: { id: workerIdParam },
      select: { id: true, firstName: true, lastName: true, projectId: true },
    });
    if (worker && worker.projectId === project.id) {
      workerPrefill = { id: worker.id, firstName: worker.firstName, lastName: worker.lastName };
    }
  }

  const signInAction = siteSignIn.bind(null, projectToken);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Agero Safety</span>
          <span className="text-xs text-zinc-500">Site sign-in</span>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{project.name}</h1>
        {project.address && (
          <p className="mt-1 text-sm text-zinc-500">{project.address}</p>
        )}

        {/* Induction requirements notice */}
        {inductionRequirements.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Safety inductions required before sign-in
            </p>
            <ul className="mt-1.5 space-y-1">
              {inductionRequirements.map((req) => (
                <li key={req.id} className="flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-400">
                  <span className="text-amber-500">•</span>
                  {req.title}
                  <span className="text-xs text-amber-500">
                    ({req.type === "generic" ? "once per year" : "site-specific"})
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-500">
              You will be directed to complete any outstanding inductions after entering your details.
            </p>
          </div>
        )}

        <div className="mt-6">
          <SignInForm signInAction={signInAction} workerPrefill={workerPrefill} />
        </div>
      </main>
    </div>
  );
}
