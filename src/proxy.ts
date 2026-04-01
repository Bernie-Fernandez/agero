import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextProxy } from "next/server";

/**
 * Next.js 16: middleware.ts is deprecated — this file is proxy.ts.
 * The exported function must be named `proxy` (or a default export).
 *
 * clerkMiddleware() returns a NextMiddleware (= NextProxy), so we can
 * assign it directly and re-export as `proxy`.
 */
export const proxy: NextProxy = clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and static assets
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
