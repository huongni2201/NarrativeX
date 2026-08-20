import { create } from "zustand";
import type {
  Chapter,
  ProductionViewMode,
  ProjectProductionDetail,
  VisualBeat,
  VisualBeatStatus,
} from "@/types/domain";

interface ProductionStore {
  project: ProjectProductionDetail | null;
  activeChapterId: string;
  activeSceneId: string;
  activeWorkspaceTab: string;
  visualBeats: VisualBeat[];
  currentView: ProductionViewMode;
  selectedVisualBeatIds: string[];
  isAddChapterModalOpen: boolean;
  activeReviewTab: "all" | "approved" | "needs_review" | "rejected";

  setView: (view: ProductionViewMode) => void;
  setActiveWorkspaceTab: (tab: string) => void;
  setActiveChapter: (chapterId: string) => void;
  setActiveScene: (sceneId: string) => void;
  setActiveReviewTab: (tab: "all" | "approved" | "needs_review" | "rejected") => void;
  openAddChapterModal: () => void;
  closeAddChapterModal: () => void;
  /** @deprecated Production Chapter creation must use features/chapters/api/chapters.api.ts. */
  addChapter: (data: { title: string; storyText: string; number?: string }) => Chapter;
  toggleSelectVisualBeat: (id: string) => void;
  selectAllVisualBeats: () => void;
  clearSelectedVisualBeats: () => void;
  batchUpdateVisualBeatsStatus: (status: VisualBeatStatus) => void;
  singleUpdateVisualBeatStatus: (id: string, status: VisualBeatStatus) => void;
  continueProject: () => void;
}

export const useProductionStore = create<ProductionStore>((set, get) => ({
  project: null,
  activeChapterId: "",
  activeSceneId: "",
  activeWorkspaceTab: "storyboard",
  visualBeats: [],
  currentView: "workspace",
  selectedVisualBeatIds: [],
  isAddChapterModalOpen: false,
  activeReviewTab: "all",

  setView: (view) => {
    if (view === "storyboard") set({ currentView: "workspace", activeWorkspaceTab: "storyboard" });
    else set({ currentView: view });
  },
  setActiveWorkspaceTab: (tab) => set({ activeWorkspaceTab: tab }),
  setActiveChapter: (chapterId) => set({ activeChapterId: chapterId }),
  setActiveScene: (sceneId) => set({ activeSceneId: sceneId }),
  setActiveReviewTab: (tab) => set({ activeReviewTab: tab }),
  openAddChapterModal: () => set({ isAddChapterModalOpen: true }),
  closeAddChapterModal: () => set({ isAddChapterModalOpen: false }),

  addChapter: () => {
    throw new Error("Legacy Zustand Chapter creation has been removed. Use chaptersApi.create instead.");
  },

  toggleSelectVisualBeat: (id) =>
    set((state) => ({
      selectedVisualBeatIds: state.selectedVisualBeatIds.includes(id)
        ? state.selectedVisualBeatIds.filter((item) => item !== id)
        : [...state.selectedVisualBeatIds, id],
    })),
  selectAllVisualBeats: () => set((state) => ({ selectedVisualBeatIds: state.visualBeats.map((v) => v.id) })),
  clearSelectedVisualBeats: () => set({ selectedVisualBeatIds: [] }),
  batchUpdateVisualBeatsStatus: (status) =>
    set((state) => {
      const selectedIds = new Set(state.selectedVisualBeatIds);
      return {
        visualBeats: state.visualBeats.map((beat) => selectedIds.has(beat.id) ? { ...beat, status } : beat),
        selectedVisualBeatIds: [],
      };
    }),
  singleUpdateVisualBeatStatus: (id, status) =>
    set((state) => ({ visualBeats: state.visualBeats.map((beat) => beat.id === id ? { ...beat, status } : beat) })),
  continueProject: () => {
    const { project } = get();
    if (!project) return;
    const reviewChapter = project.chapters.find((c) => c.status === "VISUAL_REVIEW");
    if (reviewChapter) {
      set({ activeChapterId: reviewChapter.id, currentView: "visual-review" });
      return;
    }
    const inProgressChapter = project.chapters.find(
      (c) => c.status === "GENERATING_VISUALS" || c.status === "ANALYZED" || c.status === "DRAFT",
    );
    if (inProgressChapter) {
      set({ activeChapterId: inProgressChapter.id, currentView: "workspace" });
      return;
    }
    set({ currentView: "preview" });
  },
}));
