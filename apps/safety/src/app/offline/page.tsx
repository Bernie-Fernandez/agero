"use client";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <svg className="h-7 w-7 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M8.111 8.111A6 6 0 0118 12v.01M1.394 9.393A9.75 9.75 0 0115 15m-3 3H9.75" />
          </svg>
        </div>
        <h1 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">No internet connection</h1>
        <p className="mt-2 text-sm text-zinc-500">
          This page isn&apos;t available offline. Connect to the internet and try again.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
