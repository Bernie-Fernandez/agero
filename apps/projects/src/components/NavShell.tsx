import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { ProjectContextProvider } from '@/context/ProjectContext';
import NavShellLayout from './NavShellLayout';
import { ReactNode } from 'react';

export default async function NavShell({ children }: { children: ReactNode }) {
  const user = await currentUser();
  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?';

  const [projects, leads] = await Promise.all([
    prisma.project.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.estimate.findMany({
      where: { pipelineStage: { lte: 6 } },
      select: { id: true, leadNumber: true, title: true, pipelineStage: true },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  return (
    <ProjectContextProvider projects={projects}>
      <NavShellLayout userInitials={initials} projects={projects} leads={leads}>
        {children}
      </NavShellLayout>
    </ProjectContextProvider>
  );
}
