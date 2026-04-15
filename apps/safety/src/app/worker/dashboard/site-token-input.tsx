"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SiteTokenInput() {
  const router = useRouter();
  const [token, setToken] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = token.trim();
    if (!t) return;
    router.push(`/site/${t}`);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
      <input
        value={token}
        onChange={(e) => setToken(e.target.value)}
        type="text"
        placeholder="Project token"
        className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
      />
      <button
        type="submit"
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Go
      </button>
    </form>
  );
}
