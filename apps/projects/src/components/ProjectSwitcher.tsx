'use client';
import { useState } from 'react';
import { useProject } from '@/context/ProjectContext';

type Project = { id: string; name: string };

export default function ProjectSwitcher({ projects }: { projects: Project[] }) {
  const { activeProject, setActiveProject } = useProject();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
      >
        <span className="hidden sm:inline text-zinc-400">Project</span>
        <span className="hidden sm:inline text-zinc-300">|</span>
        <span className="font-medium truncate max-w-[120px]">
          {activeProject?.name ?? 'Select project'}
        </span>
        <svg className="h-3 w-3 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 w-56 rounded-lg border border-zinc-200 bg-white shadow-lg py-1">
            {projects.length === 0 ? (
              <p className="px-3 py-2 text-xs text-zinc-400">No projects found</p>
            ) : (
              projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setActiveProject(p);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-zinc-50"
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                      activeProject?.id === p.id ? 'bg-brand' : 'bg-transparent'
                    }`}
                  />
                  <span className="text-zinc-800">{p.name}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
