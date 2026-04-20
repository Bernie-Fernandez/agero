"use client";

import { signOutWorker } from "./actions";

export function SignOutButton() {
  return (
    <form action={signOutWorker}>
      <button
        type="submit"
        className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
      >
        Sign out
      </button>
    </form>
  );
}
