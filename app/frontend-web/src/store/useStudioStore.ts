import { create } from "zustand";
import type { ProjectWizardDraft, ScreenType } from "@/types/studio";

interface StudioStore {
  currentScreen: ScreenType;
  selectedProjectId: string | null;
  wizardDraft: ProjectWizardDraft;
  isWizardOpen: boolean;

  setScreen: (screen: ScreenType) => void;
  selectProject: (projectId: string) => void;
  openWizard: (initialStep?: 1 | 2 | 3 | 4) => void;
  closeWizard: () => void;
  setWizardStep: (step: 1 | 2 | 3 | 4) => void;
  updateWizardDraft: (data: Partial<ProjectWizardDraft>) => void;
  resetSessionState: () => void;
}

const createEmptyWizardDraft = (): ProjectWizardDraft => ({
  title: "",
  description: "",
  genre: "Fantasy",
  language: "Tiếng Việt",
  aspectRatio: "16:9",
  quality: "High",
  storyText: "",
  step: 1,
});

export const useStudioStore = create<StudioStore>((set) => ({
  currentScreen: "overview",
  selectedProjectId: null,
  wizardDraft: createEmptyWizardDraft(),
  isWizardOpen: false,

  setScreen: (screen) => set({ currentScreen: screen }),
  selectProject: (projectId) => set({ selectedProjectId: String(projectId) }),
  openWizard: (initialStep = 1) =>
    set((state) => ({
      isWizardOpen: true,
      currentScreen: "wizard",
      wizardDraft:
        initialStep === 1
          ? createEmptyWizardDraft()
          : { ...state.wizardDraft, step: initialStep },
    })),
  closeWizard: () =>
    set({
      isWizardOpen: false,
      currentScreen: "overview",
      wizardDraft: createEmptyWizardDraft(),
    }),
  setWizardStep: (step) => set((state) => ({ wizardDraft: { ...state.wizardDraft, step } })),
  updateWizardDraft: (data) =>
    set((state) => ({ wizardDraft: { ...state.wizardDraft, ...data } })),
  resetSessionState: () =>
    set({
      currentScreen: "overview",
      selectedProjectId: null,
      wizardDraft: createEmptyWizardDraft(),
      isWizardOpen: false,
    }),
}));
