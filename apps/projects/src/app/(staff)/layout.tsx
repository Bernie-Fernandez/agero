import { requireAppUser, ROLE_LABELS } from "@/lib/auth";
import Link from "next/link";
import { ReactNode } from "react";

const NAV_GROUPS = [
  {
    label: "CRM",
    items: [
      { label: "Companies", href: "/crm/companies" },
      { label: "Contacts", href: "/crm/contacts" },
    ],
  },
];

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const user = await requireAppUser();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 shrink-0">
        <Link href="/" className="font-bold text-zinc-900 text-sm">
          Agero ERP
        </Link>
        <div className="ml-auto flex items-center gap-3 text-xs text-zinc-500">
          <span>
            {user.firstName} {user.lastName} &middot;{" "}
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
          {user.role === "DIRECTOR" && (
            <Link href="/admin" className="text-blue-600 hover:underline">
              Admin
            </Link>
          )}
        </div>
      </header>

      <div className="flex flex-1">
        <nav className="w-52 bg-white border-r border-gray-200 py-4 px-3 shrink-0">
          {NAV_GROUPS.map(({ label, items }) => (
            <div key={label} className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 px-3 mb-2">
                {label}
              </p>
              <ul className="space-y-0.5">
                {items.map(({ label: itemLabel, href }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="block px-3 py-2 rounded-md text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                    >
                      {itemLabel}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <main className="flex-1 p-8 min-w-0">{children}</main>
      </div>
    </div>
  );
}
