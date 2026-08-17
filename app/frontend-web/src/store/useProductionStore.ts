import { create } from "zustand";
import { Chapter, ProductionViewMode, ProjectProductionDetail, Scene, VisualBeat, VisualBeatStatus } from "@/types/domain";
import { MOCK_PROJECT_PRODUCTION, MOCK_VISUAL_BEATS_CH01 } from "@/lib/production-mock";
import { isMockDataMode } from "@/lib/data-mode";

interface ProductionStore {
  // State
  project: ProjectProductionDetail;
  activeChapterId: string;
  activeSceneId: string;
  activeWorkspaceTab: string;
  visualBeats: VisualBeat[];
  currentView: ProductionViewMode;
  selectedVisualBeatIds: string[];
  isAddChapterModalOpen: boolean;
  activeReviewTab: "all" | "approved" | "needs_review" | "rejected";

  // Actions
  setView: (view: ProductionViewMode) => void;
  setActiveWorkspaceTab: (tab: string) => void;
  setActiveChapter: (chapterId: string) => void;
  setActiveScene: (sceneId: string) => void;
  setActiveReviewTab: (tab: "all" | "approved" | "needs_review" | "rejected") => void;
  
  openAddChapterModal: () => void;
  closeAddChapterModal: () => void;
  addChapter: (data: { title: string; storyText: string; number?: string }) => Chapter;

  // Batch Visual Review Actions
  toggleSelectVisualBeat: (id: string) => void;
  selectAllVisualBeats: () => void;
  clearSelectedVisualBeats: () => void;
  batchUpdateVisualBeatsStatus: (status: VisualBeatStatus) => void;
  singleUpdateVisualBeatStatus: (id: string, status: VisualBeatStatus) => void;

  // Smart Continuation Logic
  continueProject: () => void;
}

export const useProductionStore = create<ProductionStore>((set, get) => ({
  project: MOCK_PROJECT_PRODUCTION,
  activeChapterId: "ch-01",
  activeSceneId: "scene-1",
  activeWorkspaceTab: "storyboard",
  visualBeats: isMockDataMode ? MOCK_VISUAL_BEATS_CH01 : [],
  currentView: "workspace",
  selectedVisualBeatIds: isMockDataMode ? ["beat-1", "beat-2", "beat-3"] : [],
  isAddChapterModalOpen: false,
  activeReviewTab: "all",

  setView: (view) => {
    if (view === "storyboard") {
      set({ currentView: "workspace", activeWorkspaceTab: "storyboard" });
    } else {
      set({ currentView: view });
    }
  },
  setActiveWorkspaceTab: (tab) => set({ activeWorkspaceTab: tab }),
  setActiveChapter: (chapterId) => {
    set({ activeChapterId: chapterId });
  },
  setActiveScene: (sceneId) => set({ activeSceneId: sceneId }),
  setActiveReviewTab: (tab) => set({ activeReviewTab: tab }),

  openAddChapterModal: () => set({ isAddChapterModalOpen: true }),
  closeAddChapterModal: () => set({ isAddChapterModalOpen: false }),

  addChapter: ({ title, storyText, number }) => {
    const { project } = get();
    const nextNum = number || String(project.chapters.length + 1).padStart(2, "0");
    const newChapterId = `ch-${Date.now()}`;

    const newChapter: Chapter = {
      id: newChapterId,
      number: nextNum,
      title: title || `Chapter ${nextNum}`,
      status: "DRAFT",
      scenesCount: 0,
      duration: "00:00",
      lastUpdated: "Vừa xong",
      progressPercent: 0,
      generatedVisualsCount: 0,
      totalVisualsCount: 0,
      scenes: [],
      storyExcerpt: storyText || "Đoạn văn bản câu chuyện vừa được thêm...",
    };

    set({
      project: {
        ...project,
        chapters: [...project.chapters.filter((c) => c.status !== "EMPTY"), newChapter],
        totalChapters: project.totalChapters + 1,
      },
      activeChapterId: newChapterId,
      isAddChapterModalOpen: false,
      currentView: "workspace",
    });

    return newChapter;
  },

  toggleSelectVisualBeat: (id) =>
    set((state) => {
      const exists = state.selectedVisualBeatIds.includes(id);
      return {
        selectedVisualBeatIds: exists
          ? state.selectedVisualBeatIds.filter((item) => item !== id)
          : [...state.selectedVisualBeatIds, id],
      };
    }),

  selectAllVisualBeats: () =>
    set((state) => ({
      selectedVisualBeatIds: state.visualBeats.map((v) => v.id),
    })),

  clearSelectedVisualBeats: () => set({ selectedVisualBeatIds: [] }),

  batchUpdateVisualBeatsStatus: (status) =>
    set((state) => {
      const selectedIds = new Set(state.selectedVisualBeatIds);
      return {
        visualBeats: state.visualBeats.map((beat) =>
          selectedIds.has(beat.id) ? { ...beat, status } : beat
        ),
        selectedVisualBeatIds: [],
      };
    }),

  singleUpdateVisualBeatStatus: (id, status) =>
    set((state) => ({
      visualBeats: state.visualBeats.map((beat) =>
        beat.id === id ? { ...beat, status } : beat
      ),
    })),

  // Smart Continuation Logic for long-form series
  continueProject: () => {
    const { project } = get();
    // 1. Find the first chapter that has pending review
    const reviewChapter = project.chapters.find((c) => c.status === "VISUAL_REVIEW");
    if (reviewChapter) {
      set({
        activeChapterId: reviewChapter.id,
        currentView: "visual-review",
      });
      return;
    }

    // 2. Find chapter currently in progress
    const inProgressChapter = project.chapters.find(
      (c) => c.status === "GENERATING_VISUALS" || c.status === "ANALYZED" || c.status === "DRAFT"
    );
    if (inProgressChapter) {
      set({
        activeChapterId: inProgressChapter.id,
        currentView: "workspace",
      });
      return;
    }

    // 3. If all ready, go to render/preview
    set({ currentView: "preview" });
  },
}));
