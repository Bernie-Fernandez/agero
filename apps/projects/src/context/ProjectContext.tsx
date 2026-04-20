'use client';
import { createContext, useContext, useState, ReactNode } from 'react';

type Project = { id: string; name: string };

type ProjectContextType = {
  activeProject: Project | null;
  setActiveProject: (p: Project | null) => void;
};

const ProjectContext = createContext<ProjectContextType>({
  activeProject: null,
  setActiveProject: () => {},
});

export function ProjectContextProvider({
  children,
  projects,
}: {
  children: ReactNode;
  projects: Project[];
}) {
  const [activeProject, setActiveProject] = useState<Project | null>(
    projects[0] ?? null,
  );
  return (
    <ProjectContext.Provider value={{ activeProject, setActiveProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}
