import Link from "next/link";

export default async function ConfirmedPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectToken: string }>;
  searchParams: Promise<{ name?: string; site?: string; time?: string; unknown?: string }>;
}) {
  const { projectToken } = await params;
  const { name, site, time, unknown } = await searchParams;

  const isUnknown = unknown === "1";

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
            <svg className="h-10 w-10 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>

          <h1 className="mt-5 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Signed in
          </h1>

          {name && (
            <p className="mt-2 text-lg text-zinc-700 dark:text-zinc-300">
              Welcome, <span className="font-medium">{name}</span>
            </p>
          )}

          {site && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {site}
            </p>
          )}

          {time && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {time}
            </p>
          )}

          {isUnknown && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/30">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Your site manager has been notified
              </p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                A supervisor will verify your identity before you begin work.
              </p>
            </div>
          )}

          {!isUnknown && (
            <p className="mt-5 text-sm text-zinc-500 dark:text-zinc-400">
              Have a safe day on site.
            </p>
          )}

          <Link
            href={`/site/${projectToken}`}
            className="mt-8 inline-block text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            Sign in another worker
          </Link>
        </div>
      </main>
    </div>
  );
}
