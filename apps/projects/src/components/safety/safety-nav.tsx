import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import type { UserRole } from "@/generated/safety-prisma/client";

const PORTAL_LABEL: Record<UserRole, string> = {
  admin: "Head Contractor",
  safety_manager: "Head Contractor",
  project_manager: "Head Contractor",
  site_manager: "Head Contractor",
  subcontractor_admin: "Subcontractor",
};

const navLinks = [
  { href: "/dashboard", label: "Dashboard", roles: null },
  { href: "/projects", label: "Projects", roles: null },
  {
    href: "/subcontractors",
    label: "Subcontractors",
    roles: ["admin", "safety_manager"] as UserRole[],
  },
  {
    href: "/admin/inductions/generic/builder",
    label: "Inductions",
    roles: ["admin", "safety_manager"] as UserRole[],
  },
  {
    href: "/supervisor",
    label: "Supervisor",
    roles: ["site_manager"] as UserRole[],
  },
] satisfies { href: string; label: string; roles: UserRole[] | null }[];

export function AppNav({
  currentPath,
  userRole,
}: {
  currentPath?: string;
  userRole?: UserRole;
}) {
  const visible = navLinks.filter(
    (link) => link.roles === null || (userRole && link.roles.includes(userRole)),
  );

  function isActive(linkHref: string) {
    if (!currentPath) return false;
    if (linkHref.startsWith("/admin/")) return currentPath.startsWith("/admin/inductions");
    return currentPath === linkHref || currentPath.startsWith(linkHref + "/");
  }

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Agero Safety
            </span>
            {userRole && (
              <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 tracking-wide uppercase">
                {PORTAL_LABEL[userRole]}
              </span>
            )}
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {visible.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-1.5 text-sm transition ${
                    active
                      ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <UserButton />
      </div>
    </header>
  );
}
