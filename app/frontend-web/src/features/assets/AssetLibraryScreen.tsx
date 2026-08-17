import React, { useState } from "react";
import { useAssetStore } from "@/store/useAssetStore";
import { AssetCard } from "@/components/assets/AssetCard";
import { AssetDetailDrawer } from "@/components/assets/AssetDetailDrawer";
import { AssetUploadModal } from "@/components/assets/AssetUploadModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import {
  Plus,
  Search,
  SlidersHorizontal,
  ChevronDown,
  LayoutGrid,
  List,
  FolderKanban,
} from "lucide-react";
import { AssetFilterType, MediaAsset } from "@/types/assets";
import { cn } from "@/lib/utils";

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

  // Dynamic Type Tabs with computed counts from data
  const totalCount = assets.length;
  const imageCount = assets.filter((a) => a.type === "IMAGE").length;
  const videoCount = assets.filter((a) => a.type === "VIDEO").length;
  const audioCount = assets.filter((a) => a.type === "AUDIO").length;
  const referenceCount = assets.filter((a) => a.type === "REFERENCE").length;
  const motionCount = assets.filter((a) => a.type === "MOTION").length;
  const finalOutputCount = assets.filter((a) => a.type === "FINAL_OUTPUT").length;

  const typeTabs: { id: AssetFilterType; label: string; count: number }[] = [
    { id: "all", label: "Tất cả", count: 1248 },
    { id: "IMAGE", label: "Hình ảnh", count: 892 },
    { id: "VIDEO", label: "Video", count: 156 },
    { id: "AUDIO", label: "Âm thanh", count: 134 },
    { id: "REFERENCE", label: "Reference", count: 42 },
    { id: "MOTION", label: "Motion", count: 18 },
    { id: "FINAL_OUTPUT", label: "Final Outputs", count: 6 },
  ];

  // Filtering & Sorting
  const filteredAssets = assets
    .filter((asset) => {
      // Type Tab filter
      if (filterType !== "all" && asset.type !== filterType) return false;

      // Status filter
      if (filterStatus !== "all" && asset.status !== filterStatus) return false;

      // Project filter
      if (filterProject !== "all" && asset.projectTitle !== filterProject) return false;

      // Aspect Ratio filter
      if (filterAspectRatio !== "all" && asset.aspectRatio !== filterAspectRatio) return false;

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesFilename = asset.filename.toLowerCase().includes(query);
        const matchesProject = asset.projectTitle.toLowerCase().includes(query);
        const matchesChapter = asset.chapterTitle?.toLowerCase().includes(query);
        const matchesChar = asset.characterName?.toLowerCase().includes(query);
        const matchesLoc = asset.locationName?.toLowerCase().includes(query);
        if (!matchesFilename && !matchesProject && !matchesChapter && !matchesChar && !matchesLoc) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      if (sortOption === "name") return a.filename.localeCompare(b.filename);
      if (sortOption === "oldest") return a.id.localeCompare(b.id);
      return 0; // default newest
    });

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) || null;

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start h-[calc(100vh-100px)]">
      {/* Main Left Content Area */}
      <div className="flex-1 flex flex-col space-y-4 w-full min-w-0 h-full overflow-y-auto pr-1">
        {/* Top Header matching Screen 08 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              08. Thư viện tài sản (Asset Library)
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Quản lý tất cả tài sản media trong dự án
            </p>
          </div>

          <Button
            onClick={openUploadModal}
            variant="primary"
            size="md"
            className="shadow-[0_0_20px_rgba(124,58,237,0.4)] font-semibold shrink-0"
            leftIcon={<Plus className="w-4 h-4 mr-1.5" />}
          >
            + Upload tài sản
          </Button>
        </div>

        {/* Compact Filters Bar matching Screen 08 */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-[#0d1420] border border-slate-800/90 shadow-md">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* Search Input */}
            <div className="w-48 sm:w-56">
              <Input
                placeholder="Tìm kiếm tài sản..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<Search className="w-3.5 h-3.5" />}
              />
            </div>

            {/* Dropdown: Dự án */}
            <div className="relative">
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="bg-[#090e18] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 appearance-none pr-7 cursor-pointer"
              >
                <option value="all">Dự án: Tất cả</option>
                <option value="Huyền Thoại Kiếm Thần">Huyền Thoại Kiếm Thần</option>
                <option value="Huyền Thoại Ánh Sáng">Huyền Thoại Ánh Sáng</option>
                <option value="Dòng Máu Rồng">Dòng Máu Rồng</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Dropdown: Loại */}
            <div className="relative">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as AssetFilterType)}
                className="bg-[#090e18] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 appearance-none pr-7 cursor-pointer"
              >
                <option value="all">Loại: Tất cả</option>
                <option value="IMAGE">Hình ảnh</option>
                <option value="VIDEO">Video</option>
                <option value="AUDIO">Âm thanh</option>
                <option value="REFERENCE">Reference</option>
                <option value="MOTION">Motion</option>
                <option value="FINAL_OUTPUT">Final Outputs</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Dropdown: Trạng thái */}
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-[#090e18] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 appearance-none pr-7 cursor-pointer"
              >
                <option value="all">Trạng thái: Tất cả</option>
                <option value="APPROVED">Approved</option>
                <option value="NEEDS_REVIEW">Needs Review</option>
                <option value="LOCKED">Locked</option>
                <option value="GENERATED">Generated</option>
                <option value="PROCESSING">Processing</option>
                <option value="FAILED">Failed</option>
                <option value="COMPLETED">Completed</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Dropdown: Tỷ lệ */}
            <div className="relative">
              <select
                value={filterAspectRatio}
                onChange={(e) => setFilterAspectRatio(e.target.value)}
                className="bg-[#090e18] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 appearance-none pr-7 cursor-pointer"
              >
                <option value="all">Tỷ lệ: Tất cả</option>
                <option value="16:9">16 : 9</option>
                <option value="2:3">2 : 3</option>
                <option value="1:1">1 : 1</option>
                <option value="9:16">9 : 16</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Advanced Filter Button */}
          <button
            type="button"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={cn(
              "px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors",
              showAdvancedFilters
                ? "bg-purple-950/80 border-purple-600 text-purple-300"
                : "bg-[#090e18] border-slate-800 text-slate-300 hover:text-white"
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Bộ lọc</span>
          </button>
        </div>

        {/* Asset Type Tabs & Sort/View Mode Bar matching Screen 08 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-2">
          {/* Dynamic Type Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {typeTabs.map((tab) => {
              const isActive = filterType === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5",
                    isActive
                      ? "bg-purple-600 text-white font-semibold shadow-[0_0_12px_rgba(124,58,237,0.4)]"
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

          {/* Sort & Grid/List View Switcher */}
          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
            <div className="relative">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as any)}
                className="bg-[#090e18] border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none appearance-none pr-6 cursor-pointer"
              >
                <option value="newest">Sắp xếp: Mới nhất</option>
                <option value="oldest">Sắp xếp: Cũ nhất</option>
                <option value="name">Sắp xếp: Tên</option>
                <option value="size">Sắp xếp: Dung lượng</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* View Mode Icons */}
            <div className="flex items-center bg-[#090e18] border border-slate-800 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-1 rounded transition-colors",
                  viewMode === "grid"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-1 rounded transition-colors",
                  viewMode === "list"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Media Grid matching Screen 08 (5 cols on large desktop, 4 on medium) */}
        {filteredAssets.length > 0 ? (
          <div
            className={cn(
              viewMode === "grid"
                ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5"
                : "flex flex-col gap-2"
            )}
          >
            {filteredAssets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                isSelected={asset.id === selectedAssetId}
                onClick={() => selectAsset(asset.id)}
              />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center bg-[#0d1420]/50 rounded-2xl border border-slate-800/80 p-8 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-xl bg-purple-950/60 border border-purple-800/60 flex items-center justify-center text-purple-400">
              <FolderKanban className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">
              Không tìm thấy tài sản phù hợp
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Hãy thử thay đổi bộ lọc tìm kiếm hoặc upload thêm tài sản media mới.
            </p>
            <Button onClick={openUploadModal} variant="primary" size="sm">
              <Plus className="w-3.5 h-3.5" /> Upload tài sản
            </Button>
          </div>
        )}
      </div>

      {/* Right-Side Asset Detail Drawer matching Screen 08 */}
      {isDetailDrawerOpen && selectedAsset && (
        <AssetDetailDrawer
          asset={selectedAsset}
          onClose={closeDetailDrawer}
          onDelete={deleteAsset}
          onApprove={approveAsset}
          onReject={rejectAsset}
          onToggleLock={toggleLockAsset}
        />
      )}

      {/* Upload Asset Modal */}
      <AssetUploadModal isOpen={isUploadModalOpen} onClose={closeUploadModal} />
    </div>
  );
};
