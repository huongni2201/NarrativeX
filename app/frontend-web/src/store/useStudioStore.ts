import { create } from "zustand";
import { Character, Project, ProjectWizardDraft, ScreenType } from "@/types/studio";
import { MOCK_CHARACTERS, MOCK_PROJECTS, SAMPLE_STORY_PRESET } from "@/lib/mock-data";

interface StudioStore {
  // Navigation & Screen View
  currentScreen: ScreenType;
  authMode: "login" | "register";
  isLoggedIn: boolean;
  selectedProjectId: string | null;
  selectedCharacterId: string | null;
  
  // Projects Dashboard State
  projects: Project[];
  projectFilterTab: "all" | "in_progress" | "completed" | "favorites";
  projectSearchQuery: string;

  // Character Library State
  characters: Character[];
  characterFilterProject: string;
  characterFilterStatus: string;
  characterSearchQuery: string;

  // Project Creation Wizard State
  wizardDraft: ProjectWizardDraft;
  isWizardOpen: boolean;
  
  // Actions
  setScreen: (screen: ScreenType) => void;
  setAuthMode: (mode: "login" | "register") => void;
  login: () => void;
  logout: () => void;
  
  // Dashboard Actions
  setProjectFilterTab: (tab: "all" | "in_progress" | "completed" | "favorites") => void;
  setProjectSearchQuery: (query: string) => void;
  toggleFavoriteProject: (id: string) => void;
  
  // Character Actions
  setCharacterFilterProject: (project: string) => void;
  setCharacterFilterStatus: (status: string) => void;
  setCharacterSearchQuery: (query: string) => void;
  openCharacterBible: (characterId: string) => void;
  closeCharacterBible: () => void;
  
  // Wizard Actions
  openWizard: (initialStep?: 1 | 2 | 3 | 4) => void;
  closeWizard: () => void;
  setWizardStep: (step: 1 | 2 | 3 | 4) => void;
  updateWizardDraft: (data: Partial<ProjectWizardDraft>) => void;
  loadSampleStory: () => void;
  confirmAndCreateProject: () => Project;
}

export const useStudioStore = create<StudioStore>((set, get) => ({
  currentScreen: "overview",
  authMode: "login",
  isLoggedIn: true,
  selectedProjectId: "proj-1",
  selectedCharacterId: "char-1",

  projects: MOCK_PROJECTS,
  projectFilterTab: "all",
  projectSearchQuery: "",

  characters: MOCK_CHARACTERS,
  characterFilterProject: "all",
  characterFilterStatus: "all",
  characterSearchQuery: "",

  wizardDraft: {
    title: "Huyền Thoại Ánh Sáng",
    description: "Câu chuyện về cuộc hành trình của một nhóm anh hùng chống lại thế lực bóng tối.",
    genre: "Fantasy",
    language: "Tiếng Việt",
    aspectRatio: "16:9",
    quality: "High",
    storyText: SAMPLE_STORY_PRESET,
    step: 1,
  },
  isWizardOpen: false,

  setScreen: (screen) => set({ currentScreen: screen }),
  setAuthMode: (mode) => set({ authMode: mode }),
  login: () => set({ isLoggedIn: true, currentScreen: "overview" }),
  logout: () => set({ isLoggedIn: false, currentScreen: "auth" }),

  setProjectFilterTab: (tab) => set({ projectFilterTab: tab }),
  setProjectSearchQuery: (query) => set({ projectSearchQuery: query }),
  toggleFavoriteProject: (id) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, isFavorite: !p.isFavorite } : p
      ),
    })),

  setCharacterFilterProject: (project) => set({ characterFilterProject: project }),
  setCharacterFilterStatus: (status) => set({ characterFilterStatus: status }),
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
      wizardDraft: { ...state.wizardDraft, step: initialStep },
    })),
  closeWizard: () => set({ isWizardOpen: false, currentScreen: "dashboard" }),
  setWizardStep: (step) =>
    set((state) => ({
      wizardDraft: { ...state.wizardDraft, step },
    })),
  updateWizardDraft: (data) =>
    set((state) => ({
      wizardDraft: { ...state.wizardDraft, ...data },
    })),
  loadSampleStory: () =>
    set((state) => ({
      wizardDraft: {
        ...state.wizardDraft,
        storyText: SAMPLE_STORY_PRESET,
      },
    })),
  confirmAndCreateProject: () => {
    const { wizardDraft, projects } = get();
    const newProject: Project = {
      id: `proj-${Date.now()}`,
      title: wizardDraft.title || "Dự án mới",
      description: wizardDraft.description || "Dự án tạo từ AI Story Studio",
      updatedAt: "Vừa xong",
      progress: 5,
      isFavorite: false,
      coverImage: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop",
      genre: wizardDraft.genre,
      language: wizardDraft.language,
      aspectRatio: wizardDraft.aspectRatio,
      quality: wizardDraft.quality,
      characterCount: 24,
      locationCount: 18,
      chapterCount: 15,
      sceneCount: 87,
      visualBeatsCount: 156,
    };

    set({
      projects: [newProject, ...projects],
      isWizardOpen: false,
      currentScreen: "project-workspace",
    });

    return newProject;
  },
}));
