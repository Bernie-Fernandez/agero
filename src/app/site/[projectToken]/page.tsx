import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SignInForm } from "./sign-in-form";
import { siteSignIn } from "./actions";

export default async function SiteSignInPage({
  params,
}: {
  params: Promise<{ projectToken: string }>;
}) {
  const { projectToken } = await params;

  const project = await prisma.project.findUnique({
    where: { token: projectToken },
  });

  if (!project) notFound();

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
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Enter your name and mobile to sign in to this site. Your details must match your pre-registered profile.
        </p>

        <div className="mt-6">
          <SignInForm signInAction={signInAction} />
        </div>
      </main>
    </div>
  );
}
