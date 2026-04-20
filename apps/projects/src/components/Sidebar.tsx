'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV_GROUPS = [
  {
    label: 'CRM',
    items: [
      { label: 'Companies', href: '/crm/companies' },
      { label: 'Contacts', href: '/crm/contacts' },
    ],
  },
  {
    label: 'Projects',
    items: [
      { label: 'Projects', href: '/projects' },
    ],
  },
  {
    label: 'Safety',
    items: [
      { label: 'Dashboard', href: '/dashboard' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Settings', href: '/admin' },
    ],
  },
];

function isItemActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin' || pathname.startsWith('/admin/');
  if (href === '/dashboard') return pathname === '/dashboard';
  if (href === '/projects') return pathname === '/projects' || (pathname.startsWith('/projects/') && !pathname.startsWith('/projects/deliverables'));
  return pathname === href || pathname.startsWith(href + '/');
}

function SidebarNav({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="py-4 px-3">
      {NAV_GROUPS.map(({ label, items }) => (
        <div key={label} className="mb-5">
          <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            {label}
          </p>
          <ul className="space-y-0.5">
            {items.map(({ label: itemLabel, href }) => {
              const active = isItemActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onItemClick}
                    className={`flex items-center px-3 py-[7px] text-[13px] rounded-md transition-colors ${
                      active
                        ? 'bg-zinc-100 font-medium text-zinc-900 border-r-2 border-brand'
                        : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                    }`}
                  >
                    {itemLabel}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export default function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside className="hidden md:block fixed left-0 top-12 w-[180px] h-[calc(100vh-48px)] bg-white border-r border-zinc-100 overflow-y-auto z-20">
        <SidebarNav />
      </aside>

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Mobile slide-in drawer */}
      <aside
        className={`fixed left-0 top-0 h-full w-[240px] bg-white shadow-xl z-50 transform transition-transform duration-200 ease-in-out md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold text-zinc-900 tracking-tight">AGERO</span>
            <span className="text-[9px] font-medium text-zinc-400 tracking-widest uppercase mt-0.5">ERP</span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 p-1"
            aria-label="Close menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <SidebarNav onItemClick={onClose} />
      </aside>
    </>
  );
}
