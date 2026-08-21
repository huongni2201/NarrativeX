import React, { useEffect, useState } from "react";
import { usePresetStore } from "@/store/usePresetStore";
import { PresetCard } from "@/components/presets/PresetCard";
import { PresetDetailDrawer } from "@/components/presets/PresetDetailDrawer";
import { PresetEditorModal } from "@/components/presets/PresetEditorModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Plus,
  Search,
  SlidersHorizontal,
  Palette,
} from "lucide-react";
import { PresetCategory } from "@/types/presets";
import { cn } from "@/lib/utils";
import { isMockDataMode } from "@/lib/data-mode";
import { presetsApi } from "./api/presets.api";
import { apiErrorMessage } from "@/shared/api/client";

export const StylePresetsScreen: React.FC = () => {
  const {
    presets,
    selectedPresetId,
    selectPreset,
    closeDetailDrawer,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    isDetailDrawerOpen,
    isEditorModalOpen,
    editingPreset,
    openCreateModal,
    openEditModal,
    closeEditorModal,
    savePreset,
    duplicatePreset,
    deletePreset,
  } = usePresetStore();
  const hydratePresets = usePresetStore((state) => state.hydratePresets);
  const [apiState, setApiState] = useState<"loading" | "ready" | "error">(
    isMockDataMode ? "ready" : "loading",
  );
  const [apiError, setApiError] = useState<string | null>(null);

  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (isMockDataMode) return;
    presetsApi
      .list()
      .then((items) => {
        hydratePresets(
          items.map((preset) => ({
            id: String(preset.id),
            name: preset.name,
            category: preset.category,
            description: preset.description,
            coverImage: preset.thumbnailUrl ?? "",
            tags: preset.tags,
            usedInProjectsCount: 0,
            negativeRules: preset.negativePrompt ?? undefined,
          })),
        );
        setApiState("ready");
      })
      .catch((error) => {
        setApiState("error");
        setApiError(apiErrorMessage(error, "Không thể tải style presets."));
      });
  }, [hydratePresets]);

  if (!isMockDataMode && apiState === "loading") {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-surface/40 p-8">
        <p className="text-[11px] uppercase tracking-[0.2em] text-purple-300">Style &amp; Presets</p>
        <h2 className="mt-2 text-lg font-semibold text-slate-200">Đang tải style presets…</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Đang đọc catalog phong cách từ backend.
        </p>
      </div>
    );
  }

  if (!isMockDataMode && apiState === "error") {
    return (
      <div className="rounded-2xl border border-dashed border-danger/40 bg-danger-bg/20 p-8">
        <h2 className="text-lg font-semibold text-text-primary">Không thể tải style presets</h2>
        <p className="mt-2 text-sm text-text-secondary">{apiError}</p>
      </div>
    );
  }

  const categoryTabs: { id: PresetCategory; label: string; count: number }[] = [
    { id: "VISUAL_STYLE", label: "Visual Styles", count: presets.filter((p) => p.category === "VISUAL_STYLE").length },
    { id: "IMAGE", label: "Image Presets", count: presets.filter((p) => p.category === "IMAGE").length },
    { id: "MOTION", label: "Motion Presets", count: presets.filter((p) => p.category === "MOTION").length },
    { id: "OUTFIT", label: "Outfit Presets", count: presets.filter((p) => p.category === "OUTFIT").length },
    { id: "RENDER", label: "Render Presets", count: presets.filter((p) => p.category === "RENDER").length },
  ];

  // Filtering
  const filteredPresets = presets.filter((preset) => {
    // Category filter
    if (preset.category !== activeCategory) return false;

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesName = preset.name.toLowerCase().includes(query);
      const matchesDesc = preset.description.toLowerCase().includes(query);
      const matchesTags = preset.tags.some((t) => t.toLowerCase().includes(query));
      if (!matchesName && !matchesDesc && !matchesTags) return false;
    }

    return true;
  });

  const selectedPreset = presets.find((p) => p.id === selectedPresetId) || null;

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start h-[calc(100vh-100px)]">
      {/* Main Left Content Area */}
      <div className="flex-1 flex flex-col space-y-4 w-full min-w-0 h-full overflow-y-auto pr-1">
        {/* Top Header matching Screen 09 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              Mẫu &amp; phong cách
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Quản lý phong cách, preset và cấu hình sáng tạo
            </p>
          </div>

          {isMockDataMode && <Button
            onClick={openCreateModal}
            variant="primary"
            size="md"
            className="font-semibold shrink-0"
            leftIcon={<Plus className="w-4 h-4 mr-1.5" />}
          >
            + Tạo mới
          </Button>}
        </div>

        {/* Category Tabs & Search Bar matching Screen 09 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-2">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {categoryTabs.map((tab) => {
              const isActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 whitespace-nowrap flex items-center gap-1.5",
                    isActive
                      ? "bg-primary text-white font-semibold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                      isActive
                        ? "bg-purple-900/60 text-white"
                        : "bg-slate-800 text-slate-400"
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Search & Filter Button */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-48 sm:w-56">
              <Input
                placeholder="Tìm kiếm preset…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<Search className="w-3.5 h-3.5" />}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors",
                showFilters
                  ? "bg-purple-950/80 border-purple-600 text-purple-300"
                  : "bg-surface border-slate-800 text-slate-300 hover:text-white"
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Bộ lọc</span>
            </button>
          </div>
        </div>

        {/* Preset Cards Grid matching Screen 09 (5 cards in Visual Styles) */}
        {filteredPresets.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {filteredPresets.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                isSelected={preset.id === selectedPresetId}
                onClick={() => selectPreset(preset.id)}
              />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center bg-surface/50 rounded-2xl border border-slate-800/80 p-8 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-xl bg-purple-950/60 border border-purple-800/60 flex items-center justify-center text-purple-400">
              <Palette className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">
              Không tìm thấy preset phù hợp
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Hãy thử tìm kiếm với từ khóa khác hoặc tạo preset phong cách mới cho riêng bạn.
            </p>
            <Button onClick={openCreateModal} variant="primary" size="sm">
              <Plus className="w-3.5 h-3.5" /> Tạo preset mới
            </Button>
          </div>
        )}
      </div>

      {/* Right-Side Preset Detail Drawer matching Screen 09 */}
      {isDetailDrawerOpen && selectedPreset && isMockDataMode && (
        <PresetDetailDrawer
          preset={selectedPreset}
          onClose={closeDetailDrawer}
          onEdit={openEditModal}
          onDuplicate={duplicatePreset}
          onDelete={deletePreset}
        />
      )}

      {/* Create / Edit Preset Modal */}
      {isMockDataMode && <PresetEditorModal
        isOpen={isEditorModalOpen}
        onClose={closeEditorModal}
        preset={editingPreset}
        onSave={savePreset}
      />}
    </div>
  );
};
