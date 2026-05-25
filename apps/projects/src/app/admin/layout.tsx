import { requireDirector } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import NavShell from "@/components/NavShell";
import HelpAssistant from "@/components/HelpAssistant";
import { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireDirector();
  const flag = await prisma.moduleFlag.findUnique({ where: { module: "admin" } });
  if (!flag?.enabled) redirect("/unauthorized?reason=module_disabled&module=admin");
  return (
    <NavShell>
      {children}
      <HelpAssistant />
    </NavShell>
  );
}
