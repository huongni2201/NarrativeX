import React from "react";
import type { Chapter } from "@/types/domain";
import { cn } from "@/lib/utils";

interface ChapterTimelineProps {
  chapters: Chapter[];
  activeChapterNumber: string;
  onSelectChapter: (chapter: Chapter) => void;
  progressPercent?: number;
}

export const ChapterTimeline: React.FC<ChapterTimelineProps> = ({ chapters, activeChapterNumber, onSelectChapter, progressPercent = 40 }) => (
  <div className="w-full select-none space-y-2">
    <div className="relative h-2 w-full overflow-hidden rounded-full border border-slate-800 bg-slate-900" role="progressbar" aria-label="Tiến độ chapter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, progressPercent))}>
      <div className="relative h-full rounded-full bg-gradient-to-r from-purple-600 to-indigo-500" style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }} />
    </div>
    <div className="flex items-center justify-between gap-1 overflow-x-auto py-1">
      {chapters.map((chapter) => {
        const active = chapter.number === activeChapterNumber;
        const ready = chapter.status === "RENDERED" || chapter.status === "VISUAL_READY";
        return (
          <button key={chapter.id} type="button" aria-pressed={active} onClick={() => onSelectChapter(chapter)} className={cn("min-w-[54px] flex-1 rounded-lg border px-2 py-1 text-center font-mono text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500", active ? "border-purple-400 bg-purple-600 font-bold text-white" : ready ? "border-slate-800 bg-surface text-slate-300 hover:border-purple-500/50" : "border-slate-900 bg-slate-950/60 text-slate-500")}>Ch {chapter.number}</button>
        );
      })}
    </div>
  </div>
);
