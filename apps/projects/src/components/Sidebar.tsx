'use client';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useProject } from '@/context/ProjectContext';
import { getUserBookmarks } from '@/lib/bookmarks/actions';

// ── Types ────────────────────────────────────────────────────────────────────

type NavItem = {
  label: string;
  href?: string;
  stubbed?: boolean;
};

type Bookmark = {
  id: string;
  entityType: string;
  entityLabel: string;
  entityUrl: string;
};

// ── Chevron icon ─────────────────────────────────────────────────────────────

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ── NavLink ──────────────────────────────────────────────────────────────────

function NavLink({ href, label, depth = 0, onItemClick }: { href: string; label: string; depth?: number; onItemClick?: () => void }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== '/projects' && href !== '/subcontractors' && href !== '/crm/companies' && href !== '/crm/contacts' && pathname.startsWith(href + '/')) || pathname === href;
  const isActiveExact = (() => {
    if (href === '/projects') return pathname === '/projects' || pathname.startsWith('/projects/');
    if (href === '/subcontractors') return pathname === '/subcontractors' || pathname.startsWith('/subcontractors/');
    if (href === '/crm/companies') return pathname === '/crm/companies' || pathname.startsWith('/crm/companies/');
    if (href === '/crm/contacts') return pathname === '/crm/contacts' || pathname.startsWith('/crm/contacts/');
    return pathname === href || pathname.startsWith(href + '/');
  })();

  return (
    <Link
      href={href}
      onClick={onItemClick}
      className={`flex items-center px-3 py-[7px] text-[13px] rounded-md transition-colors ${
        depth > 0 ? 'pl-6' : ''
      } ${
        isActiveExact
          ? 'bg-zinc-100 font-medium text-zinc-900 border-r-2 border-brand'
          : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
      }`}
    >
      {label}
    </Link>
  );
}

// ── StubbedItem ──────────────────────────────────────────────────────────────

function StubbedItem({ label, depth = 0 }: { label: string; depth?: number }) {
  return (
    <div
      title="Coming soon"
      className={`flex items-center justify-between px-3 py-[7px] text-[13px] rounded-md cursor-default select-none ${depth > 0 ? 'pl-6' : ''} text-zinc-400`}
    >
      <span>{label}</span>
      <span className="text-[10px] text-zinc-300 font-medium ml-1">soon</span>
    </div>
  );
}

// ── Section ──────────────────────────────────────────────────────────────────

function Section({
  sectionKey,
  label,
  children,
  defaultOpen = false,
  stubbed = false,
  onItemClick,
}: {
  sectionKey: string;
  label: string;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  stubbed?: boolean;
  onItemClick?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(`agero_sidebar_${sectionKey}`);
    if (stored !== null) setOpen(stored === 'true');
    setHydrated(true);
  }, [sectionKey]);

  function toggle() {
    if (stubbed) return;
    const next = !open;
    setOpen(next);
    if (hydrated) localStorage.setItem(`agero_sidebar_${sectionKey}`, String(next));
  }

  return (
    <div className="mb-0.5">
      <button
        onClick={toggle}
        className={`w-full flex items-center justify-between px-3 py-[7px] text-[13px] rounded-md transition-colors ${
          stubbed
            ? 'text-zinc-400 cursor-default'
            : 'text-zinc-700 hover:bg-zinc-50 font-medium'
        }`}
        disabled={stubbed}
      >
        <span>{label}</span>
        <div className="flex items-center gap-1">
          {stubbed && <span className="text-[10px] text-zinc-300 font-medium">soon</span>}
          {!stubbed && children && <Chevron open={open} />}
        </div>
      </button>
      {!stubbed && open && children && (
        <div className="ml-1 mt-0.5 space-y-0.5">{children}</div>
      )}
    </div>
  );
}

// ── BookmarksFlyout ──────────────────────────────────────────────────────────

function BookmarksFlyout({ onClose }: { onClose: () => void }) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getUserBookmarks().then((b) => { setBookmarks(b); setLoading(false); });
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const grouped: Record<string, Bookmark[]> = {};
  for (const b of bookmarks) {
    (grouped[b.entityType] = grouped[b.entityType] ?? []).push(b);
  }

  return (
    <div
      ref={ref}
      className="absolute left-[184px] top-0 w-64 bg-white border border-zinc-200 rounded-lg shadow-lg z-50 overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-zinc-100">
        <p className="text-sm font-semibold text-zinc-900">Bookmarks</p>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <p className="px-4 py-3 text-xs text-zinc-400">Loading…</p>
        ) : bookmarks.length === 0 ? (
          <p className="px-4 py-3 text-xs text-zinc-400">No bookmarks yet. Click the bookmark icon on any record to save it here.</p>
        ) : (
          Object.entries(grouped).map(([type, items]) => (
            <div key={type}>
              <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{type}</p>
              {items.map((b) => (
                <Link
                  key={b.id}
                  href={b.entityUrl}
                  className="flex items-center px-4 py-2 text-[13px] text-zinc-700 hover:bg-zinc-50"
                >
                  {b.entityLabel}
                </Link>
              ))}
            </div>
          ))
        )}
      </div>
      <div className="px-4 py-2.5 border-t border-zinc-100">
        <Link href="/bookmarks" className="text-xs text-brand hover:underline">Manage bookmarks</Link>
      </div>
    </div>
  );
}

// ── ProjectSubNav ────────────────────────────────────────────────────────────

function ProjectSubNav({ projectId, projectName, onItemClick }: { projectId: string; projectName: string; onItemClick?: () => void }) {
  return (
    <div className="ml-1 mt-0.5 space-y-0.5">
      <div className="px-3 py-1.5 text-[11px] font-semibold text-zinc-500 truncate border-l-2 border-brand ml-3">{projectName}</div>
      <StubbedItem label="Project Foundations" depth={1} />
      <StubbedItem label="Client" depth={1} />
      <NavLink href={`/subcontractors?projectId=${projectId}`} label="Subcontractors" depth={1} onItemClick={onItemClick} />
      <StubbedItem label="Purchase Orders" depth={1} />
      <NavLink href={`/projects/${projectId}/induction`} label="HSEQ / Safety" depth={1} onItemClick={onItemClick} />
      <StubbedItem label="Consultants" depth={1} />
      <StubbedItem label="Job Reports" depth={1} />
    </div>
  );
}

// ── SidebarNav ───────────────────────────────────────────────────────────────

function SidebarNav({ onItemClick }: { onItemClick?: () => void }) {
  const { activeProject } = useProject();
  const [bookmarksOpen, setBookmarksOpen] = useState(false);

  return (
    <nav className="py-3 px-2 space-y-0.5 relative">
      {/* Bookmarks */}
      <div className="relative mb-0.5">
        <button
          onClick={() => setBookmarksOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-[7px] text-[13px] rounded-md transition-colors text-zinc-700 hover:bg-zinc-50 font-medium"
        >
          <span className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            Bookmarks
          </span>
        </button>
        {bookmarksOpen && <BookmarksFlyout onClose={() => setBookmarksOpen(false)} />}
      </div>

      {/* CRM */}
      <Section sectionKey="crm" label="CRM" defaultOpen={true} onItemClick={onItemClick}>
        <NavLink href="/crm/companies" label="Companies" depth={1} onItemClick={onItemClick} />
        <NavLink href="/crm/contacts" label="Contacts" depth={1} onItemClick={onItemClick} />
      </Section>

      {/* Projects */}
      <Section sectionKey="projects" label="Projects" defaultOpen={true} onItemClick={onItemClick}>
        <NavLink href="/projects" label="All projects" depth={1} onItemClick={onItemClick} />
        {activeProject && (
          <ProjectSubNav projectId={activeProject.id} projectName={activeProject.name} onItemClick={onItemClick} />
        )}
      </Section>

      {/* Subcontractors — flat link (not under Projects top-level) */}
      <Section sectionKey="subcontractors_top" label="Subcontractors" defaultOpen={false} onItemClick={onItemClick}>
        <NavLink href="/subcontractors" label="Register" depth={1} onItemClick={onItemClick} />
      </Section>

      {/* Estimating — stubbed */}
      <Section sectionKey="estimating" label="Estimating" defaultOpen={false} stubbed />

      {/* Finance — stubbed */}
      <Section sectionKey="finance" label="Finance" defaultOpen={false} stubbed />

      {/* Reporting — stubbed */}
      <Section sectionKey="reporting" label="Reporting" defaultOpen={false} stubbed />

      {/* Marketing — stubbed */}
      <Section sectionKey="marketing" label="Marketing" defaultOpen={false} stubbed />

      {/* Admin */}
      <Section sectionKey="admin" label="Admin" defaultOpen={false} onItemClick={onItemClick}>
        <NavLink href="/admin" label="Settings" depth={1} onItemClick={onItemClick} />
      </Section>
    </nav>
  );
}

// ── Sidebar (exported) ───────────────────────────────────────────────────────

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
      <aside className="hidden md:block fixed left-0 top-12 w-[200px] h-[calc(100vh-48px)] bg-white border-r border-zinc-100 overflow-y-auto z-20">
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
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-1" aria-label="Close menu">
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
