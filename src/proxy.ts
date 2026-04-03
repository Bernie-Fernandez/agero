import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextProxy } from "next/server";

/**
 * Public routes: marketing home and Clerk-hosted auth flows.
 * Everything else requires a signed-in Clerk session.
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/inductions/(.*)",
  "/site/(.*)",
]);

export const proxy: NextProxy = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
    "/(api|trpc)(.*)",
  ],
};
