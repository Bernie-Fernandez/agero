import { requireDirector } from "@/lib/auth";
import NavShell from "@/components/NavShell";
import HelpAssistant from "@/components/HelpAssistant";
import { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireDirector();
  return (
    <NavShell>
      {children}
      <HelpAssistant />
    </NavShell>
  );
}
