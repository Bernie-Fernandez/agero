import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { ROLE_METADATA } from '@agero/db';
import { ProjectContextProvider } from '@/context/ProjectContext';
import NavShellLayout from './NavShellLayout';
import { ReactNode } from 'react';

export default async function NavShell({ children }: { children: ReactNode }) {
  const { userId } = await auth();

  const [dbUser, projects, leads] = await Promise.all([
    userId ? prisma.user.findFirst({ where: { clerkId: userId }, select: { id: true, firstName: true, lastName: true, initials: true, avatarUrl: true, role: true } }) : null,
    prisma.project.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.estimate.findMany({
      where: { pipelineStage: { lte: 6 } },
      select: { id: true, leadNumber: true, title: true, pipelineStage: true },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  const initials = dbUser?.initials ?? (dbUser ? `${dbUser.firstName[0]}${dbUser.lastName[0]}`.toUpperCase() : '?');
  const roleMeta = dbUser ? ROLE_METADATA[dbUser.role as keyof typeof ROLE_METADATA] : undefined;

  return (
    <ProjectContextProvider projects={projects}>
      <NavShellLayout
        userInitials={initials}
        userName={dbUser ? `${dbUser.firstName} ${dbUser.lastName}` : ''}
        userRole={roleMeta?.label ?? dbUser?.role ?? ''}
        userAvatarUrl={dbUser?.avatarUrl ?? null}
        isDirector={dbUser?.role === 'DIRECTOR' || dbUser?.role === 'GENERAL_MANAGER'}
        projects={projects}
        leads={leads}
      >
        {children}
      </NavShellLayout>
    </ProjectContextProvider>
  );
}
