import React from "react";
import { Chapter } from "@/types/domain";
import { cn } from "@/lib/utils";

interface ChapterTimelineProps {
  chapters: Chapter[];
  activeChapterNumber: string;
  onSelectChapter: (chapter: Chapter) => void;
  progressPercent?: number; // e.g. 40%
}

export const ChapterTimeline: React.FC<ChapterTimelineProps> = ({
  chapters,
  activeChapterNumber,
  onSelectChapter,
  progressPercent = 40,
}) => {
  return (
    <div className="w-full space-y-2 select-none">
      {/* Video Progress Line */}
      <div className="relative w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800 cursor-pointer">
        <div
          className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 rounded-full relative shadow-[0_0_12px_rgba(124,58,237,0.8)]"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Chapter Marker Buttons matching Screen 07 */}
      <div className="flex items-center justify-between gap-1 overflow-x-auto py-1">
        {chapters.map((ch) => {
          const isActive = ch.number === activeChapterNumber;
          const isReady = ch.status === "RENDERED" || ch.status === "VISUAL_READY";

          return (
            <button
              key={ch.id}
              onClick={() => onSelectChapter(ch)}
              className={cn(
                "flex-1 min-w-[54px] py-1 px-2 rounded-lg text-xs font-mono font-medium text-center transition-all border",
                isActive
                  ? "bg-purple-600 text-white border-purple-400 shadow-[0_0_15px_rgba(124,58,237,0.6)] font-bold scale-[1.03]"
                  : isReady
                  ? "bg-[#0d1420] text-slate-300 border-slate-800 hover:border-purple-500/50 hover:bg-slate-800"
                  : "bg-slate-950/60 text-slate-500 border-slate-900 hover:text-slate-400"
              )}
            >
              Ch {ch.number}
            </button>
          );
        })}
      </div>
    </div>
  );
};
