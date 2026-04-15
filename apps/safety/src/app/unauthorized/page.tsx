import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="max-w-sm text-center">
        <p className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">403</p>
        <h1 className="mt-2 text-xl font-semibold text-zinc-800 dark:text-zinc-100">
          Access denied
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          You don&apos;t have permission to view this page. Contact your administrator if you
          believe this is a mistake.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
