import { requireAppUser } from "@/lib/auth";
import NavShell from "@/components/NavShell";
import HelpAssistant from "@/components/HelpAssistant";
import { ReactNode } from "react";

export default async function StaffLayout({ children }: { children: ReactNode }) {
  await requireAppUser();
  return (
    <NavShell>
      {children}
      <HelpAssistant />
    </NavShell>
  );
}
