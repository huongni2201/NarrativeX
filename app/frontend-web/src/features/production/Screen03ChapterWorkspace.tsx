import React, { useState } from "react";
import { useProductionStore } from "@/store/useProductionStore";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { Tabs } from "@/components/ui/Tabs";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Edit3,
  Film,
  Loader2,
  Sparkles,
  ChevronRight,
  Eye,
  Volume2,
  Layers,
} from "lucide-react";
import { Scene } from "@/types/domain";

export const Screen03ChapterWorkspace: React.FC = () => {
  const {
    project,
    activeChapterId,
    setView,
    setActiveScene,
  } = useProductionStore();

  const chapter =
    project.chapters.find((c) => c.id === activeChapterId) ||
    project.chapters.find((c) => c.number === "06") ||
    project.chapters[0];

  const [activeTab, setActiveTab] = useState("overview");

  const chapterTabs = [
    { id: "overview", label: "Tổng quan" },
    { id: "content", label: "Nội dung" },
    { id: "storyboard", label: "Storyboard" },
    { id: "visuals", label: "Visuals" },
    { id: "audio", label: "Audio" },
    { id: "render", label: "Render & Export" },
  ];

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === "storyboard") setView("storyboard");
    if (tabId === "visuals") setView("visual-review");
    if (tabId === "render") setView("render");
  };

  const handleSceneClick = (scene: Scene) => {
    setActiveScene(scene.id);
    setView("storyboard");
  };

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

      {/* Chapter Workspace Header matching Screen 03 */}
      <div className="p-5 md:p-6 rounded-2xl bg-[#0d1420] border border-slate-800/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-xl">
        <div className="flex items-center gap-4">
          {/* Chapter Thumbnail */}
          <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-900 border border-purple-500/30 shrink-0 shadow-md">
            <img
              src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=300&auto=format&fit=crop"
              alt={chapter.title}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs text-purple-400 font-mono font-bold uppercase tracking-wider">
              Chapter {chapter.number}
            </span>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                {chapter.title}
              </h1>
              <button
                type="button"
                className="text-slate-500 hover:text-slate-300 p-1 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Lifecycle Stages Pills */}
            <div className="flex items-center gap-2 text-[11px] font-mono font-medium pt-0.5">
              <span className="text-slate-500">Draft</span>
              <span className="text-slate-600">→</span>
              <span className="text-slate-400">Analyzed</span>
              <span className="text-slate-600">→</span>
              <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-semibold shadow-sm">
                Visual Ready
              </span>
              <span className="text-slate-600">→</span>
              <span className="text-slate-500">Rendered</span>
            </div>
          </div>
        </div>

        {/* Right Metrics & Render Chapter Action */}
        <div className="flex flex-wrap items-center gap-5 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-slate-800 pt-3 md:pt-0">
          <div className="flex items-center gap-5 text-center">
            <div>
              <div className="text-lg font-bold text-white font-mono">
                {chapter.scenesCount || 14}
              </div>
              <div className="text-[11px] text-slate-400">Scenes</div>
            </div>
            <div>
              <div className="text-lg font-bold text-white font-mono">
                {chapter.totalVisualsCount || 38}
              </div>
              <div className="text-[11px] text-slate-400">Visual Beats</div>
            </div>
            <div>
              <div className="text-lg font-bold text-white font-mono text-purple-300">
                {chapter.duration || "07:36"}
              </div>
              <div className="text-[11px] text-purple-400">Thời lượng dự kiến</div>
            </div>
          </div>

          <Button
            onClick={() => setView("render")}
            variant="gradient"
            size="md"
            className="shadow-[0_0_20px_rgba(124,58,237,0.4)]"
          >
            Render Chapter
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <Tabs
          tabs={chapterTabs}
          activeTab={activeTab}
          onChange={handleTabChange}
          variant="underlined"
        />
      </div>

      {/* 2-Column Overview Layout matching Screen 03 */}
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
                <span className="text-[11px] text-slate-500 font-mono">Chờ xử lý</span>
              </div>

              {/* Step 5 */}
              <div className="p-3 rounded-xl bg-[#090e18] border border-slate-800/80 flex items-center justify-between opacity-70">
                <div className="flex items-center gap-2.5">
                  <Film className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-medium text-slate-300">
                    Render Chapter
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">Chờ xử lý</span>
              </div>
            </div>

            {/* Hành động nhanh Buttons matching Screen 03 */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <h3 className="text-xs font-semibold text-slate-400">Hành động nhanh</h3>
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

            {/* Scenes Grid matching Screen 03 (4 cards) */}
            <div className="p-5 md:p-6 rounded-2xl bg-[#0d1420] border border-slate-800/90 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Scenes ({chapter.scenesCount || 14})</h3>
                <button
                  type="button"
                  onClick={() => setView("storyboard")}
                  className="text-xs text-purple-400 hover:text-purple-300 font-semibold transition-colors"
                >
                  Xem tất cả &gt;
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {(chapter.scenes && chapter.scenes.length > 0
                  ? chapter.scenes.slice(0, 4)
                  : [
                      { id: "s1", number: "01", title: "Rời khỏi Hắc Vân", thumbnail: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=400&auto=format&fit=crop" },
                      { id: "s2", number: "02", title: "Giữa cơn bão tuyết", thumbnail: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=400&auto=format&fit=crop" },
                      { id: "s3", number: "03", title: "Sinh vật băng giá", thumbnail: "https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=400&auto=format&fit=crop" },
                      { id: "s4", number: "04", title: "Do thám địch", thumbnail: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=400&auto=format&fit=crop" },
                    ]
                ).map((scene: any) => (
                  <div
                    key={scene.id}
                    onClick={() => handleSceneClick(scene)}
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
    </div>
  );
};
