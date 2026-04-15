import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextProxy } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
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
