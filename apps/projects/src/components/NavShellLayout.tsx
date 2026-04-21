'use client';
import { useState, ReactNode } from 'react';
import Topbar from './Topbar';
import Sidebar from './Sidebar';

type Project = { id: string; name: string };

export default function NavShellLayout({
  userInitials,
  projects,
  children,
}: {
  userInitials: string;
  projects: Project[];
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <Topbar
        userInitials={userInitials}
        projects={projects}
        onMenuToggle={() => setSidebarOpen(true)}
      />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-12 md:ml-[200px] min-h-[calc(100vh-48px)]">
        {children}
      </main>
    </>
  );
}
