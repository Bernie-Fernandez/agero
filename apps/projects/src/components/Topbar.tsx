'use client';
import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import ProjectSwitcher from './ProjectSwitcher';
import LeadSwitcher from './LeadSwitcher';

type Project = { id: string; name: string };
type Lead = { id: string; leadNumber: string; title: string; pipelineStage: number };

function EntityPill() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative hidden md:block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50 shrink-0"
      >
        <span className="text-zinc-400">Entity</span>
        <span className="text-zinc-300">|</span>
        <span className="font-medium">Agero Group Pty Ltd</span>
        <svg className="h-3 w-3 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 w-56 rounded-lg border border-zinc-200 bg-white shadow-lg py-1">
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand shrink-0" />
              <span className="text-xs font-medium text-zinc-800">Agero Group Pty Ltd</span>
            </div>
            <div className="mx-3 my-1 border-t border-zinc-100" />
            <div className="px-3 py-2 text-xs text-zinc-400 cursor-default">+ Add entity</div>
          </div>
        </>
      )}
    </div>
  );
}

function avatarBg(name: string) {
  const colors = ['bg-purple-500','bg-blue-500','bg-green-500','bg-amber-500','bg-rose-500','bg-indigo-500','bg-teal-500','bg-orange-500'];
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

function UserMenu({
  userInitials,
  userName,
  userRole,
  userAvatarUrl,
  isDirector,
}: {
  userInitials: string;
  userName: string;
  userRole: string;
  userAvatarUrl: string | null;
  isDirector: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { signOut } = useClerk();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full hover:opacity-80 transition-opacity"
        aria-label="User menu"
      >
        {userAvatarUrl ? (
          <img src={userAvatarUrl} alt={userInitials} className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${avatarBg(userName || userInitials)}`}>
            <span className="text-white text-[10px] font-semibold">{userInitials}</span>
          </div>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100">
              <div className="font-semibold text-sm text-zinc-900 truncate">{userName}</div>
              <div className="text-xs text-zinc-500 mt-0.5 truncate">{userRole}</div>
            </div>
            <div className="py-1">
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                My profile
              </Link>
              {isDirector && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Admin panel
                </Link>
              )}
              <div className="mx-3 my-1 border-t border-zinc-100" />
              <button
                onClick={() => signOut({ redirectUrl: '/sign-in' })}
                className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Topbar({
  userInitials,
  userName,
  userRole,
  userAvatarUrl,
  isDirector,
  projects,
  leads,
  onMenuToggle,
}: {
  userInitials: string;
  userName: string;
  userRole: string;
  userAvatarUrl: string | null;
  isDirector: boolean;
  projects: Project[];
  leads: Lead[];
  onMenuToggle: () => void;
}) {
  const pathname = usePathname();
  const onLeadsRoute = pathname.startsWith('/leads');

  return (
    <header className="fixed top-0 left-0 right-0 h-12 bg-white border-b border-zinc-200 flex items-center px-4 gap-3 z-30">
      {/* Logo zone */}
      <Link href="/dashboard" className="flex items-center shrink-0">
        <div className="hidden md:flex flex-col leading-none">
          <span className="text-sm font-bold text-zinc-900 tracking-tight">AGERO</span>
          <span className="text-[9px] font-medium text-zinc-400 tracking-widest uppercase mt-0.5">ERP</span>
        </div>
        <div className="md:hidden h-[34px] w-[34px] rounded-lg bg-brand flex items-center justify-center">
          <span className="text-white text-xs font-bold tracking-tight">AEG</span>
        </div>
      </Link>

      <div className="hidden md:block w-px h-5 bg-zinc-200 shrink-0" />

      <EntityPill />

      {onLeadsRoute ? (
        <LeadSwitcher leads={leads} />
      ) : (
        <ProjectSwitcher projects={projects} />
      )}

      <div className="flex-1 min-w-0" />

      {/* Search — desktop only */}
      <div className="hidden md:flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 shrink-0">
        <svg className="h-3.5 w-3.5 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search…"
          className="bg-transparent text-xs text-zinc-700 placeholder-zinc-400 outline-none w-36"
        />
      </div>

      {/* User menu */}
      <UserMenu
        userInitials={userInitials}
        userName={userName}
        userRole={userRole}
        userAvatarUrl={userAvatarUrl}
        isDirector={isDirector}
      />

      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuToggle}
        className="md:hidden text-zinc-600 hover:text-zinc-900 p-1"
        aria-label="Open menu"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </header>
  );
}
