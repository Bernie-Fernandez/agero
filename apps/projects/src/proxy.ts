import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextProxy } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  // Safety module — worker portal, QR sign-in, inductions, and registration are public
  "/inductions/(.*)",
  "/site/(.*)",
  "/register/(.*)",
  "/worker(.*)",
  "/api/induction-chat(.*)",
  // Portal login and registration are public (Clerk handles auth for portal dashboard etc.)
  "/portal/login(.*)",
  "/portal/register(.*)",
]);

const isPortalRoute = createRouteMatcher(["/portal(.*)"]);
const isErpRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/crm(.*)",
  "/projects(.*)",
  "/subcontractors(.*)",
  "/admin(.*)",
]);

export const proxy: NextProxy = clerkMiddleware(async (auth, request) => {
  const { userId, sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;

  // PORTAL users hitting ERP routes → redirect to portal
  if (userId && role === "PORTAL" && isErpRoute(request)) {
    return NextResponse.redirect(new URL("/portal/dashboard", request.url));
  }

  // STAFF/DIRECTOR users hitting portal routes → redirect to ERP
  if (userId && role !== "PORTAL" && isPortalRoute(request) && !request.nextUrl.pathname.startsWith("/portal/login") && !request.nextUrl.pathname.startsWith("/portal/register")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Protect non-public routes
  if (!isPublicRoute(request)) {
    await auth.protect();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
    "/(api|trpc)(.*)",
  ],
};
