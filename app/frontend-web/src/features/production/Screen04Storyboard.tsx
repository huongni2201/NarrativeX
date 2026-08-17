import React, { useState } from "react";
import { useProductionStore } from "@/store/useProductionStore";
import { VisualStatusBadge } from "@/components/production/VisualStatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  ArrowLeft,
  Plus,
  Search,
  ChevronDown,
  Sparkles,
  Film,
  Layers,
  MoreVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Screen04Storyboard: React.FC = () => {
  const {
    project,
    activeChapterId,
    setActiveChapter,
    activeSceneId,
    setActiveScene,
    visualBeats,
    setView,
  } = useProductionStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const chapter =
    project.chapters.find((c) => c.id === activeChapterId) ||
    project.chapters.find((c) => c.number === "06") ||
    project.chapters[0];

  const scenes = chapter.scenes && chapter.scenes.length > 0
    ? chapter.scenes
    : [
        { id: "scene-1", number: "01", title: "Rời khỏi Hắc Vân", beatsCount: 3, approvedBeatsCount: 2 },
        { id: "scene-2", number: "02", title: "Giữa cơn bão tuyết", beatsCount: 4, approvedBeatsCount: 4 },
        { id: "scene-3", number: "03", title: "Sinh vật băng giá", beatsCount: 3, approvedBeatsCount: 3 },
        { id: "scene-4", number: "04", title: "Nghỉ chân trong rừng", beatsCount: 5, approvedBeatsCount: 5 },
      ];

  const filteredBeats = visualBeats.filter((beat) => {
    const matchesSearch =
      beat.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      beat.prompt.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || beat.status.toLowerCase() === statusFilter.toLowerCase();
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
          Storyboard – Chapter {chapter.number}
        </span>
      </div>

      {/* Top Filter and Action Bar matching Screen 04 */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#0d1420] border border-slate-800/90 shadow-md">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Chapter Selector Dropdown */}
          <div className="relative">
            <select
              value={activeChapterId}
              onChange={(e) => setActiveChapter(e.target.value)}
              className="bg-[#090e18] border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-purple-300 font-semibold focus:outline-none focus:border-purple-500 appearance-none pr-8 cursor-pointer shadow-sm"
            >
              {project.chapters.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#0d1420] text-slate-200">
                  Chapter {c.number} – {c.title}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* All Scenes Dropdown */}
          <div className="relative">
            <select
              value={activeSceneId}
              onChange={(e) => setActiveScene(e.target.value)}
              className="bg-[#090e18] border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 appearance-none pr-8 cursor-pointer"
            >
              <option value="all">All Scenes</option>
              {scenes.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#0d1420] text-slate-200">
                  Scene {s.number} – {s.title}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Status Dropdown */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#090e18] border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 appearance-none pr-8 cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="approved">Approved</option>
              <option value="needs_review">Needs Review</option>
              <option value="rejected">Rejected</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Search Box */}
          <div className="w-60">
            <Input
              placeholder="Tìm kiếm scene/visual beat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="w-3.5 h-3.5" />}
            />
          </div>
        </div>

        {/* Action Button */}
        <Button
          onClick={() => setView("visual-review")}
          variant="primary"
          size="sm"
          className="shadow-[0_0_15px_rgba(124,58,237,0.35)]"
          leftIcon={<Plus className="w-3.5 h-3.5 mr-1" />}
        >
          + Thêm Visual Beat
        </Button>
      </div>

      {/* Main Area: Sidebar Scene List + Visual Beat Grid */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Sidebar: Scene List (w-64) */}
        <div className="w-full lg:w-64 p-4 rounded-2xl bg-[#0d1420] border border-slate-800/90 space-y-2 shrink-0">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Danh sách Scene ({scenes.length})
            </h3>
          </div>

          <div className="space-y-1.5 pt-1">
            {scenes.map((scene) => {
              const isActive = scene.id === activeSceneId;
              return (
                <button
                  key={scene.id}
                  onClick={() => setActiveScene(scene.id)}
                  className={cn(
                    "w-full text-left p-3 rounded-xl transition-all flex flex-col gap-1 border",
                    isActive
                      ? "bg-purple-950/60 text-white border-purple-700/80 shadow-[0_0_15px_rgba(124,58,237,0.2)] font-semibold"
                      : "bg-[#090e18]/80 text-slate-300 border-slate-800/80 hover:bg-slate-800/60 hover:text-white"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-purple-400 font-bold">
                      Scene {scene.number}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {scene.approvedBeatsCount || 2}/{scene.beatsCount || 3} beats
                    </span>
                  </div>
                  <span className="text-xs truncate">{scene.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Grid: Visual Beats Cards matching Screen 04 */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
          {filteredBeats.map((beat) => (
            <div
              key={beat.id}
              onClick={() => setView("visual-review")}
              className="group bg-[#0d1420] hover:bg-[#111a29] border border-slate-800 hover:border-purple-500/60 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 shadow-md flex flex-col justify-between"
            >
              {/* Image Preview */}
              <div className="aspect-[16/10] w-full overflow-hidden bg-slate-900 relative">
                <img
                  src={beat.imageUrl}
                  alt={beat.description}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] font-mono font-bold text-white border border-white/10">
                  Beat {beat.number}
                </div>
              </div>

              {/* Card Meta & Status */}
              <div className="p-3 space-y-2.5">
                <p className="text-xs font-bold text-slate-200 line-clamp-1 group-hover:text-purple-300 transition-colors">
                  {beat.description}
                </p>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                  <VisualStatusBadge status={beat.status} size="sm" />
                  <span className="text-[10px] text-slate-500 font-mono">
                    {beat.durationSeconds}s
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Empty Add Card matching Screen 04 */}
          <div
            onClick={() => setView("visual-review")}
            className="border-2 border-dashed border-slate-800 hover:border-purple-500/60 bg-[#090e18]/60 hover:bg-purple-950/20 rounded-xl flex flex-col items-center justify-center p-6 text-center space-y-2 cursor-pointer transition-colors min-h-[160px]"
          >
            <div className="w-8 h-8 rounded-full bg-purple-950/60 border border-purple-700/60 flex items-center justify-center text-purple-400">
              <Plus className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-300">
              + Thêm visual beat
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
