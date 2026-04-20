'use client';
import Link from 'next/link';
import { useState } from 'react';
import ProjectSwitcher from './ProjectSwitcher';

type Project = { id: string; name: string };

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

export default function Topbar({
  userInitials,
  projects,
  onMenuToggle,
}: {
  userInitials: string;
  projects: Project[];
  onMenuToggle: () => void;
}) {
  return (
    <header className="fixed top-0 left-0 right-0 h-12 bg-white border-b border-zinc-200 flex items-center px-4 gap-3 z-30">
      {/* Logo zone */}
      <Link href="/dashboard" className="flex items-center shrink-0">
        {/* Desktop wordmark */}
        <div className="hidden md:flex flex-col leading-none">
          <span className="text-sm font-bold text-zinc-900 tracking-tight">AGERO</span>
          <span className="text-[9px] font-medium text-zinc-400 tracking-widest uppercase mt-0.5">ERP</span>
        </div>
        {/* Mobile monogram */}
        <div className="md:hidden h-[34px] w-[34px] rounded-lg bg-brand flex items-center justify-center">
          <span className="text-white text-xs font-bold tracking-tight">AEG</span>
        </div>
      </Link>

      <div className="hidden md:block w-px h-5 bg-zinc-200 shrink-0" />

      <EntityPill />

      <ProjectSwitcher projects={projects} />

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

      {/* User avatar */}
      <div className="h-7 w-7 rounded-full bg-brand flex items-center justify-center shrink-0">
        <span className="text-white text-[10px] font-semibold">{userInitials}</span>
      </div>

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
