'use client';
import { useState, ReactNode } from 'react';
import Topbar from './Topbar';
import Sidebar from './Sidebar';

type Project = { id: string; name: string };
type Lead = { id: string; leadNumber: string; title: string; pipelineStage: number };

export default function NavShellLayout({
  userInitials,
  userName,
  userRole,
  userAvatarUrl,
  isDirector,
  projects,
  leads,
  children,
}: {
  userInitials: string;
  userName: string;
  userRole: string;
  userAvatarUrl: string | null;
  isDirector: boolean;
  projects: Project[];
  leads: Lead[];
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <Topbar
        userInitials={userInitials}
        userName={userName}
        userRole={userRole}
        userAvatarUrl={userAvatarUrl}
        isDirector={isDirector}
        projects={projects}
        leads={leads}
        onMenuToggle={() => setSidebarOpen(true)}
      />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-12 md:ml-[200px] min-h-[calc(100vh-48px)]">
        {children}
      </main>
    </>
  );
}
