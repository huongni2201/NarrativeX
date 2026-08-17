import React, { useState } from "react";
import { useProductionStore } from "@/store/useProductionStore";
import { VisualStatusBadge } from "@/components/production/VisualStatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Progress } from "@/components/ui/Progress";
import { Tabs } from "@/components/ui/Tabs";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Edit3,
  Film,
  Loader2,
  Plus,
  Search,
  ChevronDown,
  Volume2,
  Sparkles,
  Zap,
  Check,
  AlertTriangle,
  X,
  FileText,
} from "lucide-react";
import { Scene, VisualBeat } from "@/types/domain";
import { cn } from "@/lib/utils";

export const Screen03ChapterWorkspace: React.FC = () => {
  const {
    project,
    activeChapterId,
    activeSceneId,
    setActiveScene,
    activeWorkspaceTab,
    setActiveWorkspaceTab,
    visualBeats,
    setView,
  } = useProductionStore();

  const chapter =
    project.chapters.find((c) => c.id === activeChapterId) ||
    project.chapters.find((c) => c.number === "01") ||
    project.chapters[0];

  const activeTab = activeWorkspaceTab || "storyboard";

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const chapterTabs = [
    { id: "overview", label: "Tổng quan" },
    { id: "content", label: "Nội dung" },
    { id: "storyboard", label: "Storyboard" },
    { id: "visuals", label: "Visuals" },
    { id: "audio", label: "Audio" },
    { id: "render", label: "Render & Export" },
  ];

  const scenes: Scene[] =
    chapter.scenes && chapter.scenes.length > 0
      ? chapter.scenes
      : [
          {
            id: "scene-1",
            number: "01",
            title: "Rời khỏi Hắc Vân",
            subtitle: "EXT. Thành Hắc Vân – Sáng sớm",
            chapterId: chapter.id,
            beatsCount: 8,
            approvedBeatsCount: 6,
            thumbnail:
              "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop",
            status: "READY",
          },
          {
            id: "scene-2",
            number: "02",
            title: "Giữa cơn bão tuyết",
            subtitle: "EXT. Đường núi – Bão tuyết",
            chapterId: chapter.id,
            beatsCount: 4,
            approvedBeatsCount: 4,
            thumbnail:
              "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop",
            status: "READY",
          },
          {
            id: "scene-3",
            number: "03",
            title: "Sinh vật băng giá",
            subtitle: "EXT. Hang băng – Ban đêm",
            chapterId: chapter.id,
            beatsCount: 3,
            approvedBeatsCount: 3,
            thumbnail:
              "https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=600&auto=format&fit=crop",
            status: "READY",
          },
          {
            id: "scene-4",
            number: "04",
            title: "Nghỉ chân trong rừng",
            subtitle: "EXT. Rừng sâu – Chiều muộn",
            chapterId: chapter.id,
            beatsCount: 5,
            approvedBeatsCount: 5,
            thumbnail:
              "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=600&auto=format&fit=crop",
            status: "READY",
          },
        ];

  const currentActiveScene =
    scenes.find((s) => s.id === activeSceneId) || scenes[0];

  const handleTabChange = (tabId: string) => {
    setActiveWorkspaceTab(tabId);
  };

  const handleSceneSelect = (sceneId: string) => {
    setActiveScene(sceneId);
  };

  const filteredBeats = visualBeats.filter((beat) => {
    const matchesSearch =
      beat.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      beat.prompt.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      beat.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
        <button
          onClick={() => setView("overview")}
          className="hover:text-purple-400 flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Dự án</span>
        </button>
        <span>/</span>
        <button
          onClick={() => setView("overview")}
          className="hover:text-slate-200 transition-colors"
        >
          {project.title}
        </button>
        <span>/</span>
        <span className="text-purple-300 font-semibold truncate">
          Chapter {chapter.number} – {chapter.title}
        </span>
      </div>

      {/* Chapter Workspace Header Card matching exact design */}
      <div className="p-5 md:p-6 rounded-2xl bg-[#0d1420] border border-slate-800/90 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-5 flex-1 min-w-0">
          {/* Chapter Thumbnail */}
          <div className="w-24 h-24 md:w-28 md:h-24 rounded-xl overflow-hidden bg-slate-900 border border-purple-500/20 shrink-0 shadow-md">
            <img
              src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=400&auto=format&fit=crop"
              alt={chapter.title}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                Chapter {chapter.number} – {chapter.title}
              </h1>
              <button
                type="button"
                className="text-slate-500 hover:text-slate-300 p-1 transition-colors"
                title="Chỉnh sửa thông tin Chapter"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 line-clamp-2 max-w-2xl leading-relaxed">
              {chapter.storyExcerpt ||
                "Khởi nguồn của số mệnh. Từ một kiếm linh thức tỉnh, một huyền thoại bắt đầu được viết nên."}
            </p>

            {/* Lifecycle & Meta Info */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-400 pt-0.5">
              <span className="text-slate-500">Trạng thái:</span>
              <span className="px-2.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 font-semibold text-[11px] shadow-sm">
                Visual Ready
              </span>
              <span className="text-slate-600">•</span>
              <span>Cập nhật: {chapter.lastUpdated || "17/05/2025 04:45"}</span>
              <span className="text-slate-600">•</span>
              <span>Bởi: {chapter.author || "Ngọc Bùi"}</span>
            </div>
          </div>
        </div>

        {/* Right Metrics & Render Chapter Action Button */}
        <div className="flex flex-wrap items-center gap-6 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 border-slate-800 pt-4 lg:pt-0">
          <div className="flex items-center gap-6 text-center">
            <div>
              <div className="text-xl font-bold text-white font-mono">
                {chapter.scenesCount || 12}
              </div>
              <div className="text-[11px] text-slate-400">Scenes</div>
            </div>
            <div>
              <div className="text-xl font-bold text-white font-mono">
                {chapter.totalVisualsCount || 32}
              </div>
              <div className="text-[11px] text-slate-400">Visual Beats</div>
            </div>
            <div>
              <div className="text-xl font-bold text-white font-mono flex items-center justify-center gap-1">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>{chapter.duration || "06:12"}</span>
              </div>
              <div className="text-[11px] text-slate-400">Thời lượng dự kiến</div>
            </div>
          </div>

          <Button
            onClick={() => setView("render")}
            variant="primary"
            size="md"
            className="shadow-[0_0_20px_rgba(124,58,237,0.45)] bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-semibold px-5 py-2.5"
            leftIcon={<Sparkles className="w-4 h-4 mr-1" />}
          >
            Render Chapter
          </Button>
        </div>
      </div>

      {/* Workspace Tabs */}
      <div className="border-b border-slate-800">
        <Tabs
          tabs={chapterTabs}
          activeTab={activeTab}
          onChange={handleTabChange}
          variant="underlined"
        />
      </div>

      {/* STORYBOARD TAB CONTENT matching design */}
      {activeTab === "storyboard" && (
        <div className="space-y-6">
          {/* Top Filter and Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 md:p-4 rounded-xl bg-[#0d1420] border border-slate-800/90 shadow-md">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Scene Selector Dropdown */}
              <div className="relative">
                <select
                  value={activeSceneId}
                  onChange={(e) => handleSceneSelect(e.target.value)}
                  className="bg-[#090e18] border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 font-medium focus:outline-none focus:border-purple-500 appearance-none pr-8 cursor-pointer shadow-sm"
                >
                  {scenes.map((s) => (
                    <option
                      key={s.id}
                      value={s.id}
                      className="bg-[#0d1420] text-slate-200"
                    >
                      Scene {s.number} – {s.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Status Filter Dropdown */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-[#090e18] border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 appearance-none pr-8 cursor-pointer"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="approved">Approved</option>
                  <option value="needs_review">Needs Review</option>
                  <option value="rejected">Rejected</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Search Box */}
              <div className="w-64 max-w-full">
                <Input
                  placeholder="Tìm kiếm visual beat..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  icon={<Search className="w-3.5 h-3.5 text-slate-400" />}
                />
              </div>
            </div>

            {/* Action Button */}
            <Button
              onClick={() => setView("visual-review")}
              variant="primary"
              size="sm"
              className="shadow-[0_0_15px_rgba(124,58,237,0.35)] bg-[#8b5cf6] hover:bg-[#7c3aed]"
              leftIcon={<Plus className="w-3.5 h-3.5 mr-1" />}
            >
              Thêm Visual Beat
            </Button>
          </div>

          {/* Main 2-Column Section */}
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Left Column: DANH SÁCH SCENE (4) */}
            <div className="w-full lg:w-72 xl:w-80 p-4 rounded-2xl bg-[#0d1420] border border-slate-800/90 space-y-3 shrink-0 shadow-lg">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  DANH SÁCH SCENE ({scenes.length})
                </h3>
              </div>

              <div className="space-y-2 pt-1">
                {scenes.map((scene) => {
                  const isActive = scene.id === activeSceneId;
                  return (
                    <button
                      key={scene.id}
                      type="button"
                      onClick={() => handleSceneSelect(scene.id)}
                      className={cn(
                        "w-full text-left p-3.5 rounded-xl transition-all flex flex-col gap-1 border",
                        isActive
                          ? "bg-purple-950/40 text-white border-purple-600/90 shadow-[0_0_15px_rgba(124,58,237,0.2)] font-semibold"
                          : "bg-[#090e18]/80 text-slate-300 border-slate-800/80 hover:bg-slate-800/50 hover:text-white"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span className="text-purple-400 font-mono">
                            {scene.number}
                          </span>
                          <span>{scene.title}</span>
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {scene.beatsCount || 8} beats
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 truncate">
                        {scene.subtitle || `EXT. Scene ${scene.number}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column: LƯỚI VISUAL BEATS */}
            <div className="flex-1 w-full space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  SCENE {currentActiveScene.number} – {currentActiveScene.title.toUpperCase()} (
                  {filteredBeats.length} BEATS)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredBeats.map((beat) => (
                  <div
                    key={beat.id}
                    onClick={() => setView("visual-review")}
                    className="group bg-[#0d1420] hover:bg-[#111a29] border border-slate-800 hover:border-purple-500/60 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 shadow-md flex flex-col justify-between"
                  >
                    {/* Image Preview with Beat Badge */}
                    <div className="aspect-[16/10] w-full overflow-hidden bg-slate-900 relative">
                      <img
                        src={beat.imageUrl}
                        alt={beat.description}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] font-mono font-bold text-white border border-white/10">
                        Beat {beat.number}
                      </div>
                    </div>

                    {/* Card Description & Status Bar */}
                    <div className="p-3 space-y-2.5">
                      <p className="text-xs font-bold text-slate-200 uppercase truncate group-hover:text-purple-300 transition-colors">
                        {beat.description}
                      </p>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                        {beat.status === "APPROVED" && (
                          <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 text-[10px] font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            <span>APPROVED</span>
                          </span>
                        )}
                        {beat.status === "NEEDS_REVIEW" && (
                          <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-600/60 text-[10px] font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>NEEDS REVIEW</span>
                          </span>
                        )}
                        {beat.status === "REJECTED" && (
                          <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-400 border border-rose-600/60 text-[10px] font-bold flex items-center gap-1">
                            <X className="w-3 h-3" />
                            <span>REJECTED</span>
                          </span>
                        )}
                        {beat.status !== "APPROVED" &&
                          beat.status !== "NEEDS_REVIEW" &&
                          beat.status !== "REJECTED" && (
                            <VisualStatusBadge status={beat.status} size="sm" />
                          )}

                        <span className="text-[10px] text-slate-400 font-mono">
                          {beat.durationSeconds}s
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Empty Add Card matching design */}
                <div
                  onClick={() => setView("visual-review")}
                  className="border-2 border-dashed border-slate-800 hover:border-purple-500/60 bg-[#090e18]/40 hover:bg-purple-950/20 rounded-xl flex flex-col items-center justify-center p-6 text-center space-y-2.5 cursor-pointer transition-all min-h-[190px] group"
                >
                  <div className="w-10 h-10 rounded-full bg-purple-950/80 border border-purple-700/60 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                    <Plus className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
                    Thêm visual beat
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OVERVIEW TAB CONTENT */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Tiến trình Chapter (5 cols) */}
          <div className="lg:col-span-5 p-5 md:p-6 rounded-2xl bg-[#0d1420] border border-slate-800/90 space-y-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Tiến trình Chapter
            </h2>

            {/* Pipeline Checklist */}
            <div className="space-y-4">
              {/* Step 1 */}
              <div className="p-3 rounded-xl bg-[#090e18] border border-slate-800/80 flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">
                      Phân tích Chapter
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono font-medium">
                      Hoàn thành: 17/08/2026 14:20
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-3 rounded-xl bg-[#090e18] border border-slate-800/80 flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">
                      Lập kế hoạch Visual Beats
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono font-medium">
                      Hoàn thành: 17/08/2026 14:45
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                    <span className="text-xs font-bold text-white">
                      Generate Visuals
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-purple-300">
                    Đang xử lý 32/38 (84%)
                  </span>
                </div>
                <Progress value={84} color="purple" />
              </div>

              {/* Step 4 */}
              <div className="p-3 rounded-xl bg-[#090e18] border border-slate-800/80 flex items-center justify-between opacity-70">
                <div className="flex items-center gap-2.5">
                  <Volume2 className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-medium text-slate-300">
                    Audio (TTS &amp; Subtitle)
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  Chờ xử lý
                </span>
              </div>

              {/* Step 5 */}
              <div className="p-3 rounded-xl bg-[#090e18] border border-slate-800/80 flex items-center justify-between opacity-70">
                <div className="flex items-center gap-2.5">
                  <Film className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-medium text-slate-300">
                    Render Chapter
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  Chờ xử lý
                </span>
              </div>
            </div>

            {/* Hành động nhanh Buttons */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <h3 className="text-xs font-semibold text-slate-400">
                Hành động nhanh
              </h3>
              <Button
                onClick={() => setView("visual-review")}
                variant="primary"
                size="sm"
                className="w-full justify-center shadow-[0_0_15px_rgba(124,58,237,0.35)]"
              >
                Generate Visuals còn lại
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setView("visual-review")}
                  className="py-2 px-3 rounded-lg bg-[#090e18] hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-300 transition-colors text-center"
                >
                  Review Visuals
                </button>
                <button
                  type="button"
                  onClick={() => setActiveWorkspaceTab("audio")}
                  className="py-2 px-3 rounded-lg bg-[#090e18] hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-300 transition-colors text-center"
                >
                  Tạo Audio
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Nội dung Chapter & Scenes (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Nội dung Chapter Excerpt */}
            <div className="p-5 md:p-6 rounded-2xl bg-[#0d1420] border border-slate-800/90 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Nội dung Chapter</h3>
                <button
                  type="button"
                  onClick={() => setActiveWorkspaceTab("content")}
                  className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 font-semibold transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Chỉnh sửa</span>
                </button>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed bg-[#090e18] p-4 rounded-xl border border-slate-800/80">
                {chapter.storyExcerpt ||
                  "Đoàn quân rời khỏi thành Hắc Vân trong sương sớm, hướng về phương Bắc lạnh giá. Trên con đường phủ đầy tuyết trắng, họ phải đối mặt với những sinh vật huyền bí và băng giá khắc nghiệt..."}
              </p>
            </div>

            {/* Scenes Grid */}
            <div className="p-5 md:p-6 rounded-2xl bg-[#0d1420] border border-slate-800/90 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">
                  Scenes ({scenes.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveWorkspaceTab("storyboard")}
                  className="text-xs text-purple-400 hover:text-purple-300 font-semibold transition-colors"
                >
                  Xem tất cả &gt;
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {scenes.slice(0, 4).map((scene) => (
                  <div
                    key={scene.id}
                    onClick={() => {
                      setActiveScene(scene.id);
                      setActiveWorkspaceTab("storyboard");
                    }}
                    className="group relative bg-[#090e18] hover:bg-[#111a29] border border-slate-800 hover:border-purple-500/60 rounded-xl overflow-hidden cursor-pointer transition-all duration-200"
                  >
                    <div className="aspect-[3/4] w-full overflow-hidden relative bg-slate-900">
                      <img
                        src={scene.thumbnail}
                        alt={scene.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-[10px] font-mono font-bold text-white border border-white/10">
                        {scene.number}
                      </div>
                    </div>
                    <div className="p-2.5 text-center">
                      <h4 className="text-xs font-semibold text-slate-200 group-hover:text-purple-300 transition-colors truncate">
                        {scene.title}
                      </h4>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTENT TAB */}
      {activeTab === "content" && (
        <div className="p-6 rounded-2xl bg-[#0d1420] border border-slate-800/90 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-400" />
              <span>Nội dung văn bản Chapter {chapter.number}</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              3,450 từ • 12 scenes
            </span>
          </div>
          <textarea
            defaultValue={
              chapter.storyExcerpt ||
              "Khởi nguồn của số mệnh. Từ một kiếm linh thức tỉnh, một huyền thoại bắt đầu được viết nên.\n\nĐoàn quân rời khỏi thành Hắc Vân trong sương sớm, hướng về phương Bắc lạnh giá. Trên con đường phủ đầy tuyết trắng, họ phải đối mặt với những sinh vật huyền bí và băng giá khắc nghiệt..."
            }
            className="w-full h-64 bg-[#090e18] border border-slate-800 rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:border-purple-500 leading-relaxed resize-none font-sans"
          />
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveWorkspaceTab("storyboard")}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setActiveWorkspaceTab("storyboard")}
            >
              Lưu thay đổi
            </Button>
          </div>
        </div>
      )}

      {/* VISUALS TAB */}
      {activeTab === "visuals" && (
        <div className="p-6 rounded-2xl bg-[#0d1420] border border-slate-800/90 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Visuals Overview</h3>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setView("visual-review")}
            >
              Mở chế độ Batch Review
            </Button>
          </div>
          <p className="text-sm text-slate-400">
            Xem và đánh giá toàn bộ hình ảnh visual beats cho Chapter {chapter.number}.
          </p>
        </div>
      )}

      {/* AUDIO TAB */}
      {activeTab === "audio" && (
        <div className="p-6 rounded-2xl bg-[#0d1420] border border-slate-800/90 space-y-4">
          <h3 className="text-base font-bold text-white">Audio &amp; Voiceover</h3>
          <p className="text-sm text-slate-400">
            Cài đặt giọng đọc AI (TTS), phụ đề và hiệu ứng âm thanh nền cho Chapter.
          </p>
        </div>
      )}

      {/* RENDER TAB */}
      {activeTab === "render" && (
        <div className="p-6 rounded-2xl bg-[#0d1420] border border-slate-800/90 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Render Chapter Video</h3>
            <Button
              variant="gradient"
              size="sm"
              onClick={() => setView("render")}
            >
              Render ngay
            </Button>
          </div>
          <p className="text-sm text-slate-400">
            Xuất video độ phân giải cao 1080p/4K với đầy đủ hiệu ứng chuyển cảnh và âm thanh.
          </p>
        </div>
      )}
    </div>
  );
};
