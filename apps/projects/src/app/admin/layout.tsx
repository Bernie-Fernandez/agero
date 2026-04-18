import { requireDirector } from "@/lib/auth";
import Link from "next/link";
import { ReactNode } from "react";

const NAV_ITEMS = [
  { label: "Overview", href: "/admin" },
  { label: "Cost Codes", href: "/admin/cost-codes" },
  { label: "Insurance Types", href: "/admin/insurance-types" },
  { label: "Payment Terms", href: "/admin/payment-terms" },
  { label: "Alert Thresholds", href: "/admin/thresholds" },
  { label: "Users", href: "/admin/users" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireDirector();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 shrink-0">
        <Link href="/" className="font-bold text-zinc-900 text-sm">Agero ERP</Link>
        <span className="text-gray-300">/</span>
        <span className="text-zinc-700 text-sm font-medium">Admin</span>
        <div className="ml-auto text-xs text-zinc-500">
          {user.firstName} {user.lastName} &middot; Director
        </div>
      </header>
      <div className="flex flex-1">
        <nav className="w-52 bg-white border-r border-gray-200 py-4 px-3 shrink-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 px-3 mb-2">
            Administration
          </p>
          <ul className="space-y-0.5">
            {NAV_ITEMS.map(({ label, href }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="block px-3 py-2 rounded-md text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="flex-1 p-8 min-w-0">{children}</main>
      </div>
    </div>
  );
}
