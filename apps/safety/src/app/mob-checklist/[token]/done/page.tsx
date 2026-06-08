import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function MobChecklistDonePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invitation = await prisma.workerInvitation.findUnique({
    where: { token },
    include: { project: { select: { name: true } } },
  });

  if (!invitation) notFound();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex h-14 max-w-lg items-center px-4">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Agero Safety</span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 mx-auto dark:bg-green-900/40">
            <svg
              className="h-10 w-10 text-green-600 dark:text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>

          <h1 className="mt-5 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Checklist complete
          </h1>

          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Your details have been recorded for{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-50">
              {invitation.project.name}
            </span>
            .
          </p>

          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            You&apos;re all set for mobilisation. Your site manager will contact you with further
            instructions.
          </p>
        </div>
      </main>
    </div>
  );
}
