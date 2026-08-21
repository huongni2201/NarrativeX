import { create } from "zustand";
import type { MediaAsset, AssetFilterType, AssetSortOption, AssetStatus } from "@/types/assets";

interface AssetStore {
  assets: MediaAsset[];
  selectedAssetId: string | null;
  filterType: AssetFilterType;
  filterStatus: string;
  filterProject: string;
  filterAspectRatio: string;
  searchQuery: string;
  sortOption: AssetSortOption;
  viewMode: "grid" | "list";
  isDetailDrawerOpen: boolean;
  isUploadModalOpen: boolean;

  hydrateAssets: (assets: MediaAsset[]) => void;
  selectAsset: (id: string | null) => void;
  closeDetailDrawer: () => void;
  setFilterType: (type: AssetFilterType) => void;
  setFilterStatus: (status: string) => void;
  setFilterProject: (project: string) => void;
  setFilterAspectRatio: (ratio: string) => void;
  setSearchQuery: (query: string) => void;
  setSortOption: (sort: AssetSortOption) => void;
  setViewMode: (mode: "grid" | "list") => void;
  openUploadModal: () => void;
  closeUploadModal: () => void;
  deleteAsset: (id: string) => void;
  approveAsset: (id: string) => void;
  rejectAsset: (id: string) => void;
  toggleLockAsset: (id: string) => void;
  addAsset: (asset: MediaAsset) => void;
}

export const useAssetStore = create<AssetStore>((set, get) => ({
  assets: [],
  selectedAssetId: null,
  filterType: "all",
  filterStatus: "all",
  filterProject: "all",
  filterAspectRatio: "all",
  searchQuery: "",
  sortOption: "newest",
  viewMode: "grid",
  isDetailDrawerOpen: false,
  isUploadModalOpen: false,

  hydrateAssets: (assets) =>
    set((state) =>
      state.assets.length > 0
        ? state
        : {
            assets,
            selectedAssetId: assets[0]?.id ?? null,
            isDetailDrawerOpen: assets.length > 0,
          },
    ),

  selectAsset: (id) =>
    set({
      selectedAssetId: id,
      isDetailDrawerOpen: id !== null,
    }),

  closeDetailDrawer: () =>
    set({
      isDetailDrawerOpen: false,
      selectedAssetId: null,
    }),

  setFilterType: (type) => set({ filterType: type }),
  setFilterStatus: (status) => set({ filterStatus: status }),
  setFilterProject: (project) => set({ filterProject: project }),
  setFilterAspectRatio: (ratio) => set({ filterAspectRatio: ratio }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSortOption: (sort) => set({ sortOption: sort }),
  setViewMode: (mode) => set({ viewMode: mode }),

  openUploadModal: () => set({ isUploadModalOpen: true }),
  closeUploadModal: () => set({ isUploadModalOpen: false }),

  deleteAsset: (id) => {
    const { assets, selectedAssetId } = get();
    const updated = assets.filter((a) => a.id !== id);
    set({
      assets: updated,
      selectedAssetId: selectedAssetId === id ? null : selectedAssetId,
      isDetailDrawerOpen: selectedAssetId === id ? false : get().isDetailDrawerOpen,
    });
  },

  approveAsset: (id) => {
    set((state) => ({
      assets: state.assets.map((a) =>
        a.id === id ? { ...a, status: "APPROVED" as AssetStatus } : a,
      ),
    }));
  },

  rejectAsset: (id) => {
    set((state) => ({
      assets: state.assets.map((a) =>
        a.id === id ? { ...a, status: "REJECTED" as AssetStatus } : a,
      ),
    }));
  },

  toggleLockAsset: (id) => {
    set((state) => ({
      assets: state.assets.map((a) =>
        a.id === id
          ? {
              ...a,
              status: (a.status === "LOCKED" ? "APPROVED" : "LOCKED") as AssetStatus,
            }
          : a,
      ),
    }));
  },

  addAsset: (asset) =>
    set((state) => ({
      assets: [asset, ...state.assets],
      isUploadModalOpen: false,
    })),
}));
