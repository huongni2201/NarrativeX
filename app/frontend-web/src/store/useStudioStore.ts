import { create } from "zustand";
import type { ProjectWizardDraft, ScreenType } from "@/types/studio";
import { SAMPLE_STORY_PRESET } from "@/features/project-creation/model/sample-story";

interface StudioStore {
  currentScreen: ScreenType;
  selectedProjectId: string | null;
  selectedCharacterId: string | null;

  projectFilterTab: "all" | "in_progress" | "completed";
  projectSearchQuery: string;

  wizardDraft: ProjectWizardDraft;
  isWizardOpen: boolean;

  setScreen: (screen: ScreenType) => void;
  setProjectFilterTab: (tab: "all" | "in_progress" | "completed") => void;
  setProjectSearchQuery: (query: string) => void;
  selectProject: (projectId: number) => void;

  openCharacterBible: (characterId: string) => void;
  closeCharacterBible: () => void;

  openWizard: (initialStep?: 1 | 2 | 3 | 4) => void;
  closeWizard: () => void;
  setWizardStep: (step: 1 | 2 | 3 | 4) => void;
  updateWizardDraft: (data: Partial<ProjectWizardDraft>) => void;
  loadSampleStory: () => void;
}

const createEmptyWizardDraft = (): ProjectWizardDraft => ({
  title: "",
  description: "",
  genre: "Fantasy",
  language: "Tiếng Việt",
  aspectRatio: "16:9",
  quality: "High",
  storyText: "",
  rightsAttestationAccepted: false,
  step: 1,
});

export const useStudioStore = create<StudioStore>((set) => ({
  currentScreen: "overview",
  selectedProjectId: null,
  selectedCharacterId: null,

  projectFilterTab: "all",
  projectSearchQuery: "",

  wizardDraft: createEmptyWizardDraft(),
  isWizardOpen: false,

  setScreen: (screen) => set({ currentScreen: screen }),
  setProjectFilterTab: (tab) => set({ projectFilterTab: tab }),
  setProjectSearchQuery: (query) => set({ projectSearchQuery: query }),
  selectProject: (projectId) => set({ selectedProjectId: String(projectId) }),

  openCharacterBible: (characterId) =>
    set({
      selectedCharacterId: characterId,
      currentScreen: "character-bible",
    }),
  closeCharacterBible: () =>
    set({
      selectedCharacterId: null,
      currentScreen: "characters",
    }),

  openWizard: (initialStep = 1) =>
    set((state) => ({
      isWizardOpen: true,
      currentScreen: "wizard",
      wizardDraft:
        initialStep === 1
          ? createEmptyWizardDraft()
          : { ...state.wizardDraft, step: initialStep, rightsAttestationAccepted: false },
    })),
  closeWizard: () =>
    set({
      isWizardOpen: false,
      currentScreen: "overview",
      wizardDraft: createEmptyWizardDraft(),
    }),
  setWizardStep: (step) =>
    set((state) => ({
      wizardDraft: { ...state.wizardDraft, step },
    })),
  updateWizardDraft: (data) =>
    set((state) => ({
      wizardDraft: {
        ...state.wizardDraft,
        ...data,
        ...(data.storyText !== undefined && data.storyText !== state.wizardDraft.storyText
          ? { rightsAttestationAccepted: false }
          : {}),
      },
    })),
  loadSampleStory: () =>
    set((state) => ({
      wizardDraft: {
        ...state.wizardDraft,
        storyText: SAMPLE_STORY_PRESET,
        rightsAttestationAccepted: false,
      },
    })),
}));
