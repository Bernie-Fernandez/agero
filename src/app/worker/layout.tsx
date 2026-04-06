import Link from "next/link";
import { getWorkerSession } from "@/lib/worker-auth";

export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  const session = await getWorkerSession();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <Link
            href={session ? "/worker/dashboard" : "/worker/login"}
            className="text-sm font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Agero Safety
          </Link>
          {session && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {session.workerAccount.firstName} {session.workerAccount.lastName}
            </span>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-8">{children}</main>
    </div>
  );
}
