import React, { useState } from "react";
import { useProductionStore } from "@/store/useProductionStore";
import { ChapterTimeline } from "@/components/production/ChapterTimeline";
import { Button } from "@/components/ui/Button";
import {
  ArrowLeft,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Subtitles,
  Sparkles,
  GripVertical,
  Sliders,
} from "lucide-react";
import { Chapter } from "@/types/domain";

export const Screen07LongFormPreview: React.FC = () => {
  const { project, activeChapterId, setActiveChapter, setView } =
    useProductionStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [activeChapterNumber, setActiveChapterNumber] = useState("06");

  const readyChapters = project.chapters.filter(
    (c) => c.status === "RENDERED" || c.status === "VISUAL_READY" || c.status === "GENERATING_VISUALS"
  );

  const handleSelectChapter = (ch: Chapter) => {
    setActiveChapter(ch.id);
    setActiveChapterNumber(ch.number);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header with Back Button matching Screen 07 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("overview")}
            className="px-3 py-1.5 rounded-lg bg-[#0d1420] hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại</span>
          </button>
          <h1 className="text-base font-bold text-white tracking-wide">
            Preview – {project.title}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-950/80 text-purple-300 border border-purple-700/60">
            1080P • 58:42
          </span>
        </div>
      </div>

      {/* Large 16:9 Video Player Box matching Screen 07 */}
      <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-purple-500/30 shadow-[0_0_50px_rgba(0,0,0,0.8)] group select-none">
        {/* Cinematic Video Background Frame */}
        <img
          src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1600&auto=format&fit=crop"
          alt="Video preview frame"
          className="w-full h-full object-cover opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30" />

        {/* Center Play/Pause Floating Icon Button */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-purple-600/80 hover:bg-purple-500 backdrop-blur-md border border-purple-400/60 text-white flex items-center justify-center shadow-[0_0_30px_rgba(124,58,237,0.8)] transition-all hover:scale-110 active:scale-95"
        >
          {isPlaying ? (
            <Pause className="w-7 h-7 fill-white" />
          ) : (
            <Play className="w-7 h-7 fill-white ml-1" />
          )}
        </button>

        {/* Bottom Video Controls Bar matching Screen 07 */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/80 to-transparent flex items-center justify-between gap-4 text-white text-xs">
          {/* Play/Pause & Time */}
          <div className="flex items-center gap-3 font-mono">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>

            <span className="font-semibold text-slate-200">
              00:23:15 <span className="text-slate-500">/</span> 00:58:42
            </span>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-slate-300"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-slate-300">
              <Subtitles className="w-4 h-4" />
            </button>
            <button className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-slate-300">
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Chapter Timeline with Marker Buttons matching Screen 07 */}
      <div className="p-4 rounded-xl bg-[#0d1420] border border-slate-800/90 shadow-md">
        <ChapterTimeline
          chapters={project.chapters}
          activeChapterNumber={activeChapterNumber}
          onSelectChapter={handleSelectChapter}
          progressPercent={40}
        />
      </div>

      {/* Chapters trong video Horizontal Reel matching Screen 07 */}
      <div className="p-5 rounded-2xl bg-[#0d1420] border border-slate-800/90 space-y-3.5 shadow-md">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Chapters trong video
          </h3>
          <button
            type="button"
            className="text-xs text-purple-400 hover:text-purple-300 font-semibold transition-colors flex items-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Tùy chỉnh thứ tự</span>
          </button>
        </div>

        {/* Horizontal Cards Reel */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {readyChapters.slice(0, 6).map((ch) => (
            <div
              key={ch.id}
              onClick={() => handleSelectChapter(ch)}
              className={`group bg-[#090e18] hover:bg-[#111a29] border rounded-xl overflow-hidden cursor-pointer transition-all duration-200 ${
                ch.number === activeChapterNumber
                  ? "border-purple-500 shadow-[0_0_15px_rgba(124,58,237,0.3)] ring-1 ring-purple-500/50"
                  : "border-slate-800 hover:border-slate-700"
              }`}
            >
              {/* Thumbnail */}
              <div className="aspect-[16/10] w-full overflow-hidden bg-slate-900 relative">
                <img
                  src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=300&auto=format&fit=crop"
                  alt={ch.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute top-1 left-1 px-1 rounded bg-black/70 text-[9px] font-mono font-bold text-white">
                  {ch.number}
                </div>
              </div>

              {/* Info */}
              <div className="p-2 space-y-0.5">
                <h4 className="text-[11px] font-semibold text-slate-200 truncate group-hover:text-purple-300 transition-colors">
                  {ch.title}
                </h4>
                <p className="text-[10px] text-slate-500 font-mono">{ch.duration}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
