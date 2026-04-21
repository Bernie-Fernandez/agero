'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/portal/dashboard' },
  { label: 'Workers', href: '/portal/workers' },
  { label: 'Insurance', href: '/portal/insurance' },
  { label: 'Documents', href: '/portal/documents' },
];

export default function PortalShell({
  children,
  companyName,
  userName,
}: {
  children: ReactNode;
  companyName: string;
  userName: string;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Topbar */}
      <header className="fixed top-0 left-0 right-0 h-12 bg-white border-b border-zinc-200 z-30 flex items-center px-4 gap-4">
        <div className="flex flex-col leading-none">
          <span className="text-sm font-bold text-zinc-900 tracking-tight">AGERO</span>
          <span className="text-[9px] font-medium text-zinc-400 tracking-widest uppercase">PORTAL</span>
        </div>
        <div className="h-4 w-px bg-zinc-200 mx-1" />
        <span className="text-sm font-medium text-zinc-700 truncate max-w-[200px]">{companyName}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center">
            {userName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <form action="/portal/sign-out" method="POST">
            <button type="submit" className="text-xs text-zinc-500 hover:text-zinc-800">Sign out</button>
          </form>
        </div>
      </header>

      <div className="flex pt-12">
        {/* Sidebar */}
        <aside className="fixed left-0 top-12 w-[180px] h-[calc(100vh-48px)] bg-white border-r border-zinc-100 overflow-y-auto z-20">
          <nav className="py-4 px-3">
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Menu</p>
            <ul className="space-y-0.5">
              {NAV_ITEMS.map(({ label, href }) => {
                const active = pathname === href || pathname.startsWith(href + '/');
                return (
                  <li key={href}>
                    <Link href={href}
                      className={`flex items-center px-3 py-[7px] text-[13px] rounded-md transition-colors ${active ? 'bg-zinc-100 font-medium text-zinc-900 border-r-2 border-brand' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'}`}>
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        {/* Main content */}
        <main className="ml-[180px] flex-1 min-h-[calc(100vh-48px)]">
          {children}
        </main>
      </div>
    </div>
  );
}
