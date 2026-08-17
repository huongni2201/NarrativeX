import { create } from "zustand";
import { ProjectWizardDraft, ScreenType } from "@/types/studio";
import { SAMPLE_STORY_PRESET } from "@/lib/mock-data";

interface StudioStore {
  // Navigation & Screen View
  currentScreen: ScreenType;
  selectedProjectId: string | null;
  selectedCharacterId: string | null;

  // Projects Dashboard UI state. Server data belongs to React Query.
  projectFilterTab: "all" | "in_progress" | "completed";
  projectSearchQuery: string;

  // Character Library UI state. Character data belongs to its API query when available.
  characterFilterProject: string;
  characterFilterRole: string;
  characterFilterGender: string;
  characterFilterStatus: string;
  characterFilterGroup: string;
  characterFilterCategoryTab: "all" | "main" | "supporting" | "minor" | "groups";
  characterSortBy: "recent" | "name_asc" | "name_desc" | "most_used" | "version";
  characterViewMode: "grid" | "list";
  isMoreFiltersOpen: boolean;
  characterAdvancedFilters: {
    minAppearances?: number;
    onlyLocked?: boolean;
    hasReferences?: boolean;
  };
  characterSearchQuery: string;

  // Project Creation Wizard State
  wizardDraft: ProjectWizardDraft;
  isWizardOpen: boolean;

  // Actions
  setScreen: (screen: ScreenType) => void;

  // Dashboard Actions
  setProjectFilterTab: (tab: "all" | "in_progress" | "completed") => void;
  setProjectSearchQuery: (query: string) => void;
  selectProject: (projectId: number) => void;

  // Character Actions
  setCharacterFilterProject: (project: string) => void;
  setCharacterFilterRole: (role: string) => void;
  setCharacterFilterGender: (gender: string) => void;
  setCharacterFilterStatus: (status: string) => void;
  setCharacterFilterGroup: (group: string) => void;
  setCharacterFilterCategoryTab: (tab: "all" | "main" | "supporting" | "minor" | "groups") => void;
  setCharacterSortBy: (sortBy: "recent" | "name_asc" | "name_desc" | "most_used" | "version") => void;
  setCharacterViewMode: (mode: "grid" | "list") => void;
  setIsMoreFiltersOpen: (isOpen: boolean) => void;
  setCharacterAdvancedFilters: (filters: { minAppearances?: number; onlyLocked?: boolean; hasReferences?: boolean }) => void;
  resetCharacterFilters: () => void;
  setCharacterSearchQuery: (query: string) => void;
  openCharacterBible: (characterId: string) => void;
  closeCharacterBible: () => void;

  // Wizard Actions
  openWizard: (initialStep?: 1 | 2 | 3 | 4) => void;
  closeWizard: () => void;
  setWizardStep: (step: 1 | 2 | 3 | 4) => void;
  updateWizardDraft: (data: Partial<ProjectWizardDraft>) => void;
  loadSampleStory: () => void;
}

export const useStudioStore = create<StudioStore>((set) => ({
  currentScreen: "overview",
  selectedProjectId: null,
  selectedCharacterId: null,

  projectFilterTab: "all",
  projectSearchQuery: "",

  characterFilterProject: "all",
  characterFilterRole: "all",
  characterFilterGender: "all",
  characterFilterStatus: "all",
  characterFilterGroup: "all",
  characterFilterCategoryTab: "all",
  characterSortBy: "recent",
  characterViewMode: "grid",
  isMoreFiltersOpen: false,
  characterAdvancedFilters: {},
  characterSearchQuery: "",

  wizardDraft: {
    title: "Huyền Thoại Ánh Sáng",
    description: "Câu chuyện về cuộc hành trình của một nhóm anh hùng chống lại thế lực bóng tối.",
    genre: "Fantasy",
    language: "Tiếng Việt",
    aspectRatio: "16:9",
    quality: "High",
    storyText: SAMPLE_STORY_PRESET,
    rightsAttestationAccepted: false,
    step: 1,
  },
  isWizardOpen: false,

  setScreen: (screen) => set({ currentScreen: screen }),

  setProjectFilterTab: (tab) => set({ projectFilterTab: tab }),
  setProjectSearchQuery: (query) => set({ projectSearchQuery: query }),
  selectProject: (projectId) => set({ selectedProjectId: String(projectId) }),

  setCharacterFilterProject: (project) => set({ characterFilterProject: project }),
  setCharacterFilterRole: (role) => set({ characterFilterRole: role }),
  setCharacterFilterGender: (gender) => set({ characterFilterGender: gender }),
  setCharacterFilterStatus: (status) => set({ characterFilterStatus: status }),
  setCharacterFilterGroup: (group) => set({ characterFilterGroup: group }),
  setCharacterFilterCategoryTab: (tab) => set({ characterFilterCategoryTab: tab }),
  setCharacterSortBy: (sortBy) => set({ characterSortBy: sortBy }),
  setCharacterViewMode: (mode) => set({ characterViewMode: mode }),
  setIsMoreFiltersOpen: (isOpen) => set({ isMoreFiltersOpen: isOpen }),
  setCharacterAdvancedFilters: (filters) =>
    set((state) => ({
      characterAdvancedFilters: { ...state.characterAdvancedFilters, ...filters },
    })),
  resetCharacterFilters: () =>
    set({
      characterFilterProject: "all",
      characterFilterRole: "all",
      characterFilterGender: "all",
      characterFilterStatus: "all",
      characterFilterGroup: "all",
      characterFilterCategoryTab: "all",
      characterSortBy: "recent",
      characterSearchQuery: "",
      characterAdvancedFilters: {},
    }),
  setCharacterSearchQuery: (query) => set({ characterSearchQuery: query }),
  openCharacterBible: (characterId) =>
    set({
      selectedCharacterId: characterId,
      currentScreen: "character-bible",
    }),
  closeCharacterBible: () =>
    set({
      currentScreen: "characters",
    }),

  openWizard: (initialStep = 1) =>
    set((state) => ({
      isWizardOpen: true,
      currentScreen: "wizard",
      // Consent is specific to the story currently being submitted. Never
      // carry it into a later wizard session, even when the draft is kept.
      wizardDraft: { ...state.wizardDraft, step: initialStep, rightsAttestationAccepted: false },
    })),
  closeWizard: () => set({ isWizardOpen: false, currentScreen: "overview" }),
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
      },
    })),
}));
