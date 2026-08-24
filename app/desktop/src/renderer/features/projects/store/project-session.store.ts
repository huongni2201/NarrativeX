import { create } from "zustand";

interface ProjectSessionState {
  activeProjectId: string | null;
  setActiveProject(id: string): void;
  clearActiveProject(): void;
}

export const useProjectSessionStore = create<ProjectSessionState>((set) => ({
  activeProjectId: null,
  setActiveProject: (activeProjectId) => set({ activeProjectId }),
  clearActiveProject: () => set({ activeProjectId: null }),
}));
