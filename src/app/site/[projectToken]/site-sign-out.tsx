"use client";

import { clearSiteSession } from "./site-sign-out-action";

export function SiteSignOutLink({ projectToken }: { projectToken: string }) {
  return (
    <form action={clearSiteSession.bind(null, projectToken)}>
      <button
        type="submit"
        className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
      >
        Not you? Use a different number
      </button>
    </form>
  );
}
