import { requireAppUser } from "@/lib/auth";
import NavShell from "@/components/NavShell";
import { ReactNode } from "react";

export default async function StaffLayout({ children }: { children: ReactNode }) {
  await requireAppUser();
  return <NavShell>{children}</NavShell>;
}
