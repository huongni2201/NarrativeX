import React, { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAssetStore } from "@/store/useAssetStore";
import { AssetCard } from "@/components/assets/AssetCard";
import { AssetDetailDrawer } from "@/components/assets/AssetDetailDrawer";
import { AssetUploadModal } from "@/components/assets/AssetUploadModal";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { Input } from "@/components/ui/Input";
import { Plus, Search, SlidersHorizontal, ChevronDown, LayoutGrid, List, FolderKanban } from "lucide-react";
import type { AssetFilterType, AssetSortOption, MediaAsset } from "@/types/assets";
import { cn } from "@/lib/utils";
import { isMockDataMode } from "@/lib/data-mode";
import { queryKeys } from "@/lib/query-keys";
import { assetsApi, type ApiMediaAsset } from "./api/assets.api";
import { apiErrorMessage } from "@/shared/api/client";

const assetTypes: Array<{ id: AssetFilterType; label: string }> = [
  { id: "all", label: "Tất cả" },
  { id: "IMAGE", label: "Hình ảnh" },
  { id: "VIDEO", label: "Video" },
  { id: "AUDIO", label: "Âm thanh" },
  { id: "REFERENCE", label: "Reference" },
  { id: "MOTION", label: "Motion" },
  { id: "FINAL_OUTPUT", label: "Final Outputs" },
];

function parseFileSize(value: string) {
  const match = value.trim().match(/^([\d.]+)\s*(B|KB|MB|GB|TB)?$/i);
  if (!match) return 0;
  const amount = Number(match[1]);
  const unit = (match[2] ?? "B").toUpperCase();
  const multiplier: Record<string, number> = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };
  return amount * (multiplier[unit] ?? 1);
}

function compareAssets(a: MediaAsset, b: MediaAsset, sortOption: AssetSortOption) {
  if (sortOption === "name") return a.filename.localeCompare(b.filename, "vi");
  if (sortOption === "size") return parseFileSize(b.fileSize) - parseFileSize(a.fileSize);
  const aTime = Date.parse(a.createdAt) || 0;
  const bTime = Date.parse(b.createdAt) || 0;
  return sortOption === "oldest" ? aTime - bTime : bTime - aTime;
}

function mapApiAsset(asset: ApiMediaAsset): MediaAsset {
  return {
    id: asset.id,
    filename: asset.originalFilename,
    type: asset.type,
    status: asset.status as MediaAsset["status"],
    thumbnailUrl: "",
    fileSize: formatFileSize(asset.sizeBytes),
    duration: asset.durationMs ? `${Math.round(asset.durationMs / 1000)}s` : undefined,
    createdAt: asset.createdAt,
    projectTitle: "Global media library",
  };
}

export const AssetLibraryScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const {
    assets: mockAssets,
    selectedAssetId,
    selectAsset,
    closeDetailDrawer,
    filterType,
    setFilterType,
    filterStatus,
    setFilterStatus,
    filterProject,
    setFilterProject,
    filterAspectRatio,
    setFilterAspectRatio,
    searchQuery,
    setSearchQuery,
    sortOption,
    setSortOption,
    viewMode,
    setViewMode,
    isDetailDrawerOpen,
    isUploadModalOpen,
    openUploadModal,
    closeUploadModal,
    deleteAsset,
    approveAsset,
    rejectAsset,
    toggleLockAsset,
  } = useAssetStore();
  const assetsQuery = useQuery({
    queryKey: queryKeys.assets,
    queryFn: () => assetsApi.list(),
    enabled: !isMockDataMode,
    select: (page) => page.items.map(mapApiAsset),
  });
  const assets = useMemo(
    () => (isMockDataMode ? mockAssets : (assetsQuery.data ?? [])),
    [assetsQuery.data, mockAssets],
  );
  const [apiError, setApiError] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const loadAssets = useCallback(async () => {
    if (isMockDataMode) return;
    await queryClient.invalidateQueries({ queryKey: queryKeys.assets });
  }, [queryClient]);

  const handleDelete = useCallback(async (id: string) => {
    if (isMockDataMode) {
      deleteAsset(id);
      return;
    }
    try {
      await assetsApi.delete(id);
      closeDetailDrawer();
      await loadAssets();
    } catch (error) {
      setApiError(apiErrorMessage(error, "Không thể xóa tài sản."));
    }
  }, [closeDetailDrawer, deleteAsset, loadAssets]);

  const handleApprove = useCallback((id: string) => {
    approveAsset(id);
  }, [approveAsset]);

  const typeTabs = useMemo(
    () => assetTypes.map((tab) => ({
      ...tab,
      count: tab.id === "all" ? assets.length : assets.filter((asset) => asset.type === tab.id).length,
    })),
    [assets],
  );

  const projectOptions = useMemo(
    () => Array.from(new Set(assets.map((asset) => asset.projectTitle).filter(Boolean))).sort((a, b) => a.localeCompare(b, "vi")),
    [assets],
  );

  const filteredAssets = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("vi");
    return assets
      .filter((asset) => {
        if (filterType !== "all" && asset.type !== filterType) return false;
        if (filterStatus !== "all" && asset.status !== filterStatus) return false;
        if (filterProject !== "all" && asset.projectTitle !== filterProject) return false;
        if (filterAspectRatio !== "all" && asset.aspectRatio !== filterAspectRatio) return false;
        if (!query) return true;
        return [asset.filename, asset.projectTitle, asset.chapterTitle, asset.characterName, asset.locationName]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLocaleLowerCase("vi").includes(query));
      })
      .sort((a, b) => compareAssets(a, b, sortOption));
  }, [assets, filterAspectRatio, filterProject, filterStatus, filterType, searchQuery, sortOption]);

  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) ?? null;

  if (!isMockDataMode && assetsQuery.isPending) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-surface/40 p-8">
        <p className="text-[11px] uppercase tracking-[0.2em] text-orange-300">Asset Library</p>
        <LoadingState
          message="Đang tải thư viện tài sản…"
          className="mt-5 justify-start text-slate-200"
        />
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Đang đọc metadata media từ backend.
        </p>
      </div>
    );
  }

  if (!isMockDataMode && assetsQuery.isError) {
    return (
      <div className="rounded-2xl border border-dashed border-danger/40 bg-danger-bg/20 p-8">
        <h2 className="text-lg font-semibold text-text-primary">Không thể tải thư viện tài sản</h2>
        <p className="mt-2 text-sm text-text-secondary">
          {apiErrorMessage(assetsQuery.error, "Không thể tải thư viện tài sản.")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start h-[calc(100vh-100px)]">
      <div className="flex-1 flex flex-col space-y-4 w-full min-w-0 h-full overflow-y-auto pr-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white md:text-2xl">Thư viện tài sản</h1>
            <p className="text-xs text-slate-400 mt-0.5">Quản lý tất cả tài sản media trong dự án</p>
          </div>
          <Button onClick={openUploadModal} variant="primary" size="md" className="font-semibold shrink-0" leftIcon={<Plus className="w-4 h-4 mr-1.5" />}>Upload tài sản</Button>
        </div>
        {apiError && <p role="alert" className="rounded-lg border border-danger/30 bg-danger-bg/20 px-3 py-2 text-xs text-danger">{apiError}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-surface border border-slate-800/90 shadow-md">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <div className="w-48 sm:w-56">
              <Input aria-label="Tìm kiếm tài sản" placeholder="Tìm kiếm tài sản…" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} icon={<Search className="w-3.5 h-3.5" />} />
            </div>

            <SelectField label="Lọc theo dự án" value={filterProject} onChange={setFilterProject}>
              <option value="all">Dự án: Tất cả</option>
              {projectOptions.map((project) => <option key={project} value={project}>{project}</option>)}
            </SelectField>

            <SelectField label="Lọc theo loại tài sản" value={filterType} onChange={(value) => setFilterType(value as AssetFilterType)}>
              <option value="all">Loại: Tất cả</option>
              {assetTypes.filter((item) => item.id !== "all").map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </SelectField>

            <SelectField label="Lọc theo trạng thái" value={filterStatus} onChange={setFilterStatus}>
              <option value="all">Trạng thái: Tất cả</option>
              {(isMockDataMode
                ? ['PENDING_UPLOAD', 'UPLOADING', 'VALIDATING', 'READY', 'REJECTED', 'APPROVED', 'NEEDS_REVIEW', 'LOCKED', 'GENERATED', 'PROCESSING', 'FAILED', 'COMPLETED']
                : ['PENDING_UPLOAD', 'UPLOADING', 'VALIDATING', 'READY', 'REJECTED']
              ).map((status) => <option key={status} value={status}>{status}</option>)}
            </SelectField>

            <SelectField label="Lọc theo tỷ lệ" value={filterAspectRatio} onChange={setFilterAspectRatio}>
              <option value="all">Tỷ lệ: Tất cả</option>
              {['16:9', '2:3', '1:1', '9:16'].map((ratio) => <option key={ratio} value={ratio}>{ratio}</option>)}
            </SelectField>
          </div>

          <button type="button" aria-pressed={showAdvancedFilters} onClick={() => setShowAdvancedFilters((value) => !value)} className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors", showAdvancedFilters ? "border-primary bg-primary-muted text-primary-light" : "border-border bg-surface-2 text-text-secondary hover:text-text-primary")}>
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Bộ lọc</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-1 overflow-x-auto" aria-label="Loại tài sản">
            {typeTabs.map((tab) => {
              const isActive = filterType === tab.id;
              return (
                <button key={tab.id} type="button" aria-pressed={isActive} onClick={() => setFilterType(tab.id)} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 whitespace-nowrap flex items-center gap-1.5", isActive ? "bg-orange-600 text-white font-semibold" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40")}>
                  <span>{tab.label}</span>
                  <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-mono", isActive ? "bg-orange-900/60 text-white" : "bg-slate-800 text-slate-400")}>{tab.count}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
            <SelectField label="Sắp xếp tài sản" value={sortOption} onChange={(value) => setSortOption(value as AssetSortOption)} compact>
              <option value="newest">Sắp xếp: Mới nhất</option>
              <option value="oldest">Sắp xếp: Cũ nhất</option>
              <option value="name">Sắp xếp: Tên</option>
              <option value="size">Sắp xếp: Dung lượng</option>
            </SelectField>
            <div className="flex items-center bg-surface-panel border border-slate-800 rounded-lg p-0.5" aria-label="Kiểu hiển thị">
              <button type="button" aria-label="Hiển thị dạng lưới" aria-pressed={viewMode === "grid"} onClick={() => setViewMode("grid")} className={cn("p-1 rounded transition-colors", viewMode === "grid" ? "bg-orange-600 text-white" : "text-slate-400 hover:text-slate-200")}><LayoutGrid className="w-3.5 h-3.5" /></button>
              <button type="button" aria-label="Hiển thị dạng danh sách" aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")} className={cn("p-1 rounded transition-colors", viewMode === "list" ? "bg-orange-600 text-white" : "text-slate-400 hover:text-slate-200")}><List className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>

        {filteredAssets.length > 0 ? (
          <div className={cn(viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5" : "flex flex-col gap-2")}>
            {filteredAssets.map((asset) => <AssetCard key={asset.id} asset={asset} isSelected={asset.id === selectedAssetId} onClick={() => selectAsset(asset.id)} />)}
          </div>
        ) : (
          <div className="py-20 text-center bg-surface/50 rounded-2xl border border-slate-800/80 p-8 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-xl bg-orange-950/60 border border-orange-800/60 flex items-center justify-center text-orange-400"><FolderKanban className="w-6 h-6" /></div>
            <h3 className="text-sm font-semibold text-slate-200">Không tìm thấy tài sản phù hợp</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">Hãy thử thay đổi bộ lọc hoặc upload thêm tài sản media mới.</p>
            <Button onClick={openUploadModal} variant="primary" size="sm"><Plus className="w-3.5 h-3.5" /> Upload tài sản</Button>
          </div>
        )}
      </div>

      {isDetailDrawerOpen && selectedAsset && <AssetDetailDrawer asset={selectedAsset} onClose={closeDetailDrawer} onDelete={handleDelete} onApprove={isMockDataMode && canApprove(selectedAsset.status) ? handleApprove : undefined} onReject={isMockDataMode ? rejectAsset : undefined} onToggleLock={isMockDataMode ? toggleLockAsset : undefined} />}
      <AssetUploadModal isOpen={isUploadModalOpen} onClose={closeUploadModal} onUploaded={loadAssets} />
    </div>
  );
};

function SelectField({ label, value, onChange, children, compact = false }: Readonly<{ label: string; value: string; onChange: (value: string) => void; children: React.ReactNode; compact?: boolean }>) {
  return (
    <div className="relative">
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className={cn("bg-surface-panel border border-slate-800 rounded-lg text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 appearance-none cursor-pointer", compact ? "px-2.5 py-1 pr-6" : "px-3 py-1.5 pr-7")}>
        {children}
      </select>
      <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 ** 2) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  return `${(sizeBytes / 1024 ** 2).toFixed(1)} MB`;
}

function canApprove(status: MediaAsset["status"]) {
  return status === "PENDING_UPLOAD" || status === "UPLOADING" || status === "VALIDATING";
}
