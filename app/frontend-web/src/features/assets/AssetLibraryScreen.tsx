import React, { useMemo, useState } from "react";
import { useAssetStore } from "@/store/useAssetStore";
import { AssetCard } from "@/components/assets/AssetCard";
import { AssetDetailDrawer } from "@/components/assets/AssetDetailDrawer";
import { AssetUploadModal } from "@/components/assets/AssetUploadModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus, Search, SlidersHorizontal, ChevronDown, LayoutGrid, List, FolderKanban } from "lucide-react";
import type { AssetFilterType, AssetSortOption, MediaAsset } from "@/types/assets";
import { cn } from "@/lib/utils";
import { isMockDataMode } from "@/lib/data-mode";

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

export const AssetLibraryScreen: React.FC = () => {
  const {
    assets,
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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

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

  if (!isMockDataMode) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-[#0d1420]/40 p-8">
        <p className="text-[11px] uppercase tracking-[0.2em] text-purple-300">Asset Library</p>
        <h2 className="mt-2 text-lg font-semibold text-slate-200">Asset API chưa sẵn sàng</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Upload, duyệt và xoá tài sản sẽ được bật khi backend có contract lưu trữ. API mode không hiển thị dữ liệu fixture.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start h-[calc(100vh-100px)]">
      <div className="flex-1 flex flex-col space-y-4 w-full min-w-0 h-full overflow-y-auto pr-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">08. Thư viện tài sản (Asset Library)</h1>
            <p className="text-xs text-slate-400 mt-0.5">Quản lý tất cả tài sản media trong dự án</p>
          </div>
          <Button onClick={openUploadModal} variant="primary" size="md" className="font-semibold shrink-0" leftIcon={<Plus className="w-4 h-4 mr-1.5" />}>
            Upload tài sản
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-[#0d1420] border border-slate-800/90 shadow-md">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <div className="w-48 sm:w-56">
              <Input aria-label="Tìm kiếm tài sản" placeholder="Tìm kiếm tài sản..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} icon={<Search className="w-3.5 h-3.5" />} />
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
              {['APPROVED', 'NEEDS_REVIEW', 'LOCKED', 'GENERATED', 'PROCESSING', 'FAILED', 'COMPLETED'].map((status) => <option key={status} value={status}>{status}</option>)}
            </SelectField>

            <SelectField label="Lọc theo tỷ lệ" value={filterAspectRatio} onChange={setFilterAspectRatio}>
              <option value="all">Tỷ lệ: Tất cả</option>
              {['16:9', '2:3', '1:1', '9:16'].map((ratio) => <option key={ratio} value={ratio}>{ratio}</option>)}
            </SelectField>
          </div>

          <button type="button" aria-pressed={showAdvancedFilters} onClick={() => setShowAdvancedFilters((value) => !value)} className={cn("px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors", showAdvancedFilters ? "bg-purple-950/80 border-purple-600 text-purple-300" : "bg-[#090e18] border-slate-800 text-slate-300 hover:text-white")}>
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Bộ lọc</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-1 overflow-x-auto" aria-label="Loại tài sản">
            {typeTabs.map((tab) => {
              const isActive = filterType === tab.id;
              return (
                <button key={tab.id} type="button" aria-pressed={isActive} onClick={() => setFilterType(tab.id)} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 whitespace-nowrap flex items-center gap-1.5", isActive ? "bg-purple-600 text-white font-semibold" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40")}>
                  <span>{tab.label}</span>
                  <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-mono", isActive ? "bg-purple-900/60 text-white" : "bg-slate-800 text-slate-400")}>{tab.count}</span>
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
            <div className="flex items-center bg-[#090e18] border border-slate-800 rounded-lg p-0.5" aria-label="Kiểu hiển thị">
              <button type="button" aria-label="Hiển thị dạng lưới" aria-pressed={viewMode === "grid"} onClick={() => setViewMode("grid")} className={cn("p-1 rounded transition-colors", viewMode === "grid" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-slate-200")}><LayoutGrid className="w-3.5 h-3.5" /></button>
              <button type="button" aria-label="Hiển thị dạng danh sách" aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")} className={cn("p-1 rounded transition-colors", viewMode === "list" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-slate-200")}><List className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>

        {filteredAssets.length > 0 ? (
          <div className={cn(viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5" : "flex flex-col gap-2")}>
            {filteredAssets.map((asset) => <AssetCard key={asset.id} asset={asset} isSelected={asset.id === selectedAssetId} onClick={() => selectAsset(asset.id)} />)}
          </div>
        ) : (
          <div className="py-20 text-center bg-[#0d1420]/50 rounded-2xl border border-slate-800/80 p-8 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-xl bg-purple-950/60 border border-purple-800/60 flex items-center justify-center text-purple-400"><FolderKanban className="w-6 h-6" /></div>
            <h3 className="text-sm font-semibold text-slate-200">Không tìm thấy tài sản phù hợp</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">Hãy thử thay đổi bộ lọc hoặc upload thêm tài sản media mới.</p>
            <Button onClick={openUploadModal} variant="primary" size="sm"><Plus className="w-3.5 h-3.5" /> Upload tài sản</Button>
          </div>
        )}
      </div>

      {isDetailDrawerOpen && selectedAsset && <AssetDetailDrawer asset={selectedAsset} onClose={closeDetailDrawer} onDelete={deleteAsset} onApprove={approveAsset} onReject={rejectAsset} onToggleLock={toggleLockAsset} />}
      <AssetUploadModal isOpen={isUploadModalOpen} onClose={closeUploadModal} />
    </div>
  );
};

function SelectField({ label, value, onChange, children, compact = false }: Readonly<{ label: string; value: string; onChange: (value: string) => void; children: React.ReactNode; compact?: boolean }>) {
  return (
    <div className="relative">
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className={cn("bg-[#090e18] border border-slate-800 rounded-lg text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 appearance-none cursor-pointer", compact ? "px-2.5 py-1 pr-6" : "px-3 py-1.5 pr-7")}>
        {children}
      </select>
      <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}
