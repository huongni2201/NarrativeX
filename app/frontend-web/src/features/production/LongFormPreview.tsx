import Image from "next/image";
import React, { useState } from "react";
import { useProductionStore } from "@/store/useProductionStore";
import { ChapterTimeline } from "@/components/production/ChapterTimeline";
import {
  ArrowLeft,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Subtitles,
  SlidersHorizontal,
} from "lucide-react";
import { Chapter } from "@/types/domain";

export const LongFormPreview: React.FC = () => {
  const { project, setActiveChapter, setView } =
    useProductionStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [activeChapterNumber, setActiveChapterNumber] = useState("06");

  if (!project) return null;

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
            className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-3 border border-border-dark text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại</span>
          </button>
          <h1 className="text-base font-bold text-white tracking-wide">
            Preview: {project.title}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-primary-muted text-primary-light border border-primary/40">
            1080P · 58:42
          </span>
        </div>
      </div>

      {/* Large 16:9 Video Player Box matching Screen 07 */}
      <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-border-dark shadow-2xl group select-none">
        {/* Cinematic Video Background Frame */}
        <Image
          src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1600&auto=format&fit=crop"
          alt="Video preview frame"
          fill
          sizes="100vw"
          className="w-full h-full object-cover opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30" />

        {/* Center Play/Pause Floating Icon Button */}
        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          aria-label={isPlaying ? "Tạm dừng phát video" : "Bắt đầu phát video"}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-primary hover:bg-primary-hover border border-primary text-white flex items-center justify-center shadow-xl transition-transform hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {isPlaying ? (
            <Pause className="w-7 h-7 fill-white" />
          ) : (
            <Play className="w-7 h-7 fill-white ml-1" />
          )}
        </button>

        {/* Bottom Video Controls Bar matching Screen 07 */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/80 to-transparent flex items-center justify-between gap-4 text-white text-xs">
          {/* Left: Play/Pause, Duration */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              aria-label={isPlaying ? "Tạm dừng" : "Phát"}
              className="text-slate-300 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded p-0.5"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </button>
            <span className="font-mono text-xs text-slate-300">
              00:23:15 / 00:58:42
            </span>
          </div>

          {/* Right: Volume, Subtitles, Quality, Fullscreen */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              aria-label={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
              className="text-slate-300 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded p-0.5"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              aria-label="Phụ đề"
              className="text-slate-300 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded p-0.5"
            >
              <Subtitles className="w-4 h-4" />
            </button>
            <span className="font-mono text-[10px] bg-primary-muted border border-primary/40 text-primary-light px-1.5 py-0.5 rounded">
              1080P
            </span>
            <button
              type="button"
              aria-label="Toàn màn hình"
              className="text-slate-300 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded p-0.5"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Chapter Track Timeline */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Timeline Chapters ({readyChapters.length}/{project.chapters.length} ready)
          </h3>
          <button
            type="button"
            onClick={() => setView("overview")}
            className="text-xs text-primary-light hover:text-primary-light transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            Mở Chapter Workspace →
          </button>
        </div>

        {/* Chapter Timeline with Marker Buttons matching Screen 07 */}
        <div className="p-4 rounded-xl bg-surface border border-border-dark shadow-md">
          <ChapterTimeline
            chapters={project.chapters}
            activeChapterNumber={activeChapterNumber}
            onSelectChapter={handleSelectChapter}
            progressPercent={40}
          />
        </div>
      </div>

      {/* Chapters trong video Horizontal Reel matching Screen 07 */}
      <div className="p-5 rounded-2xl bg-surface border border-border-dark space-y-3.5 shadow-md">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Chapters trong video
          </h3>
          <button
            type="button"
            className="text-xs text-primary-light hover:text-primary-light font-semibold transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Tùy chỉnh thứ tự</span>
          </button>
        </div>

        {/* Horizontal Cards Reel */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {readyChapters.slice(0, 6).map((ch) => (
            <button
              type="button"
              key={ch.id}
              onClick={() => handleSelectChapter(ch)}
              aria-pressed={ch.number === activeChapterNumber}
              className={`group w-full text-left bg-surface-panel hover:bg-surface-2 border rounded-xl overflow-hidden transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                ch.number === activeChapterNumber
                  ? "border-primary ring-1 ring-primary/50"
                  : "border-border-dark hover:border-surface-3"
              }`}
            >
              {/* Thumbnail */}
              <div className="aspect-[16/10] w-full overflow-hidden bg-slate-900 relative">
                <Image
                  src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=300&auto=format&fit=crop"
                  alt={ch.title}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 16vw"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute top-1 left-1 px-1 rounded bg-black/70 text-[9px] font-mono font-bold text-white">
                  {ch.number}
                </div>
              </div>

              {/* Info */}
              <div className="p-2 space-y-0.5">
                <h4 className="text-[11px] font-semibold text-slate-200 truncate group-hover:text-primary-light transition-colors">
                  {ch.title}
                </h4>
                <p className="text-[10px] text-slate-500 font-mono">{ch.duration}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
