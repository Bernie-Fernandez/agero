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
  // Portal login, registration, and sign-out are public (Clerk handles auth for portal dashboard etc.)
  "/portal/login(.*)",
  "/portal/register(.*)",
  "/portal/sign-out(.*)",
]);

const isPortalRoute = createRouteMatcher(["/portal(.*)"]);
const isErpRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/crm(.*)",
  "/projects(.*)",
  "/subcontractors(.*)",
  "/admin(.*)",
]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isFinanceRoute = createRouteMatcher(["/finance(.*)"]);
const isEstimatingRoute = createRouteMatcher(["/leads(.*)", "/estimating(.*)"]);
const isSafetyRoute = createRouteMatcher(["/safety(.*)", "/inductions(.*)", "/site(.*)"]);
const isMarketingRoute = createRouteMatcher(["/marketing(.*)", "/tenders(.*)"]);

// Roles with admin access
const ADMIN_ROLES = ["DIRECTOR", "GENERAL_MANAGER"];
// Roles with finance access
const FINANCE_ROLES = ["DIRECTOR","GENERAL_MANAGER","CONSTRUCTION_MANAGER","PROJECT_DIRECTOR","FINANCIAL_CONTROLLER","BOOKKEEPER","SENIOR_CONTRACTS_ADMIN","CONTRACTS_ADMIN"];
// Roles with estimating access
const ESTIMATING_ROLES = ["DIRECTOR","GENERAL_MANAGER","CONSTRUCTION_MANAGER","PROJECT_DIRECTOR","SENIOR_CONSULTANT_PRECON","SENIOR_ESTIMATOR","CONSULTANT_PRECON","ESTIMATOR","BUSINESS_DEVELOPER","SALES_EXEC_ADMIN"];
// Roles with marketing access
const MARKETING_ROLES = ["DIRECTOR","GENERAL_MANAGER","CONSTRUCTION_MANAGER","PROJECT_DIRECTOR","BUSINESS_DEVELOPER","SALES_EXEC_ADMIN","MARKETING_COORD"];

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

  // Module permission gates (role from Clerk session metadata)
  if (userId && role) {
    if (isAdminRoute(request) && !ADMIN_ROLES.includes(role)) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
    if (isFinanceRoute(request) && !FINANCE_ROLES.includes(role)) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
    if (isEstimatingRoute(request) && !ESTIMATING_ROLES.includes(role)) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
    if (isMarketingRoute(request) && !MARKETING_ROLES.includes(role)) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
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
