import { create } from "zustand";
import type { StylePreset, PresetCategory } from "@/types/presets";
import { isMockDataMode } from "@/lib/data-mode";

interface PresetStore {
  presets: StylePreset[];
  selectedPresetId: string | null;
  activeCategory: PresetCategory;
  searchQuery: string;
  isDetailDrawerOpen: boolean;
  isEditorModalOpen: boolean;
  editingPreset: StylePreset | null;

  hydrateDemoPresets: (presets: StylePreset[]) => void;
  selectPreset: (id: string | null) => void;
  closeDetailDrawer: () => void;
  setActiveCategory: (category: PresetCategory) => void;
  setSearchQuery: (query: string) => void;
  openCreateModal: () => void;
  openEditModal: (preset: StylePreset) => void;
  closeEditorModal: () => void;
  savePreset: (preset: Partial<StylePreset>) => void;
  duplicatePreset: (id: string) => void;
  deletePreset: (id: string) => void;
}

export const usePresetStore = create<PresetStore>((set, get) => ({
  presets: [],
  selectedPresetId: null,
  activeCategory: "VISUAL_STYLE",
  searchQuery: "",
  isDetailDrawerOpen: false,
  isEditorModalOpen: false,
  editingPreset: null,

  hydrateDemoPresets: (presets) =>
    set((state) =>
      state.presets.length > 0
        ? state
        : {
            presets,
            selectedPresetId: presets[0]?.id ?? null,
            isDetailDrawerOpen: presets.length > 0,
          },
    ),

  selectPreset: (id) =>
    set({
      selectedPresetId: id,
      isDetailDrawerOpen: id !== null,
    }),

  closeDetailDrawer: () =>
    set({
      isDetailDrawerOpen: false,
      selectedPresetId: null,
    }),

  setActiveCategory: (category) =>
    set({
      activeCategory: category,
    }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  openCreateModal: () =>
    set({
      isEditorModalOpen: true,
      editingPreset: null,
    }),

  openEditModal: (preset) =>
    set({
      isEditorModalOpen: true,
      editingPreset: preset,
    }),

  closeEditorModal: () =>
    set({
      isEditorModalOpen: false,
      editingPreset: null,
    }),

  savePreset: (presetData) => {
    const { presets, editingPreset } = get();
    if (editingPreset) {
      set({
        presets: presets.map((p) =>
          p.id === editingPreset.id ? ({ ...p, ...presetData } as StylePreset) : p,
        ),
        isEditorModalOpen: false,
        editingPreset: null,
      });
    } else {
      const newPreset: StylePreset = {
        id: `preset-${Date.now()}`,
        name: presetData.name || "Preset mới",
        category: presetData.category || get().activeCategory,
        description: presetData.description || "Cấu hình sáng tạo tái sử dụng",
        coverImage:
          presetData.coverImage ||
          "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop",
        tags: presetData.tags || ["CUSTOM"],
        usedInProjectsCount: 0,
        colorPalette: presetData.colorPalette || ["#070B14", "#111A29", "#7C3AED", "#F59E0B", "#E2E8F0"],
        lighting: presetData.lighting || "Tự nhiên, kịch tính",
        atmosphere: presetData.atmosphere || "Điện ảnh, huyền bí",
        cameraStyle: presetData.cameraStyle || "35mm cinematic",
        defaultAspectRatio: presetData.defaultAspectRatio || "16:9",
        defaultQuality: presetData.defaultQuality || "Standard",
        motionPreset: presetData.motionPreset || "Slow Pan",
        negativeRules: presetData.negativeRules || "No low quality, no watermark",
        usedInProjects: [],
      };
      set({
        presets: [newPreset, ...presets],
        selectedPresetId: newPreset.id,
        isDetailDrawerOpen: true,
        isEditorModalOpen: false,
        editingPreset: null,
      });
    }
  },

  duplicatePreset: (id) => {
    const { presets } = get();
    const source = presets.find((p) => p.id === id);
    if (!source) return;

    const duplicated: StylePreset = {
      ...source,
      id: `preset-${Date.now()}`,
      name: `${source.name} (Bản sao)`,
      isDefault: false,
      usedInProjectsCount: 0,
      usedInProjects: [],
    };

    set({
      presets: [duplicated, ...presets],
      selectedPresetId: duplicated.id,
      isDetailDrawerOpen: true,
    });
  },

  deletePreset: (id) => {
    const { presets, selectedPresetId } = get();
    set({
      presets: presets.filter((p) => p.id !== id),
      selectedPresetId: selectedPresetId === id ? null : selectedPresetId,
      isDetailDrawerOpen: selectedPresetId === id ? false : get().isDetailDrawerOpen,
    });
  },
}));

if (isMockDataMode) {
  void import("@/lib/presets-mock").then(({ MOCK_PRESETS }) => {
    usePresetStore.getState().hydrateDemoPresets(MOCK_PRESETS);
  });
}
