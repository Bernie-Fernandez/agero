import { headers } from "next/headers";
import NavShell from "@/components/NavShell";
import { ReactNode } from "react";

// Routes in (safety) that are public-facing — skip the nav shell
const PUBLIC_PREFIXES = [
  "/worker",
  "/site",
  "/register",
  "/sign-in",
  "/sign-up",
  "/inductions",
];

export default async function SafetyLayout({ children }: { children: ReactNode }) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const skipShell = PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (skipShell) return <>{children}</>;
  return <NavShell>{children}</NavShell>;
}
