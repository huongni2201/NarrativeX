import { useState } from "react";
import { ChevronDown, ChevronRight, Filter, Plus, Search, Sparkles } from "lucide-react";
import type { DesktopTimelineBeat } from "@narrativex/client-contracts";
import type { EditorChapterGroup } from "../editor-timeline";

interface EditorExplorerPanelProps {
  hierarchy: EditorChapterGroup[];
  selectedBeatId: string;
  onSelectBeat: (beat: DesktopTimelineBeat) => void;
  query: string;
  onQueryChange: (query: string) => void;
  onAddChapter?: () => void;
}

export function EditorExplorerPanel({
  hierarchy,
  selectedBeatId,
  onSelectBeat,
  query,
  onQueryChange,
  onAddChapter,
}: Readonly<EditorExplorerPanelProps>) {
  const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>({});

  const toggleChapter = (chapterId: string) => {
    setCollapsedChapters((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-border/70 bg-[#0c1017]">
      {/* Search Header */}
      <div className="flex items-center gap-2 border-b border-border/50 p-3">
        <div className="relative flex flex-1 items-center">
          <Search size={14} className="pointer-events-none absolute left-3 text-muted-foreground" />
          <input
            type="text"
            className="h-9 w-full rounded-lg border border-border/70 bg-[#111722] pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-primary/70 focus:outline-none focus:ring-1 focus:ring-primary/40"
            placeholder="Tìm kiếm chapter, visual beat..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-[#111722] text-muted-foreground transition hover:border-border hover:bg-[#161f2e] hover:text-foreground"
          title="Bộ lọc tìm kiếm"
          aria-label="Filter"
        >
          <Filter size={14} />
        </button>
      </div>

      {/* Chapters & Beats List */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border/40">
        {hierarchy.map((group) => {
          const isCollapsed = Boolean(collapsedChapters[group.chapter.chapterId]);
          const chapterDurationMs = Math.max(0, group.chapter.endMs - group.chapter.startMs);
          const totalBeats = group.scenes.reduce((acc, scene) => acc + scene.beats.length, 0);

          return (
            <div key={group.chapter.chapterId} className="space-y-1.5">
              {/* Chapter Accordion Header */}
              <button
                type="button"
                className="flex w-full items-center justify-between px-1 py-1.5 text-left text-xs text-muted-foreground transition hover:text-foreground"
                onClick={() => toggleChapter(group.chapter.chapterId)}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#ff8a00]">
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  <span>CHAPTER {String(group.chapter.orderIndex + 1).padStart(2, "0")}</span>
                  <span className="font-normal lowercase text-muted-foreground/80">· {totalBeats} beats</span>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {formatDurationMinutes(chapterDurationMs)}
                </span>
              </button>

              {/* Beats within Chapter */}
              {!isCollapsed && (
                <div className="space-y-2 pl-0.5">
                  {group.scenes.flatMap((scene) => scene.beats).map((beat) => {
                    const isSelected = beat.visualBeatId === selectedBeatId;
                    const beatNumber = String(beat.beatIndex + 1).padStart(2, "0");

                    return (
                      <button
                        key={beat.visualBeatId}
                        type="button"
                        onClick={() => onSelectBeat(beat)}
                        className={`group relative flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-all duration-150 ${
                          isSelected
                            ? "border-[#ff8a00] bg-gradient-to-r from-[#ff8a00]/15 via-[#1a1c24] to-[#121620] shadow-[0_0_15px_rgba(255,138,0,0.18)] ring-1 ring-[#ff8a00]/40"
                            : "border-border/50 bg-[#101520]/80 hover:border-border hover:bg-[#151c2b]"
                        }`}
                      >
                        {/* Thumbnail / Media Preview */}
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-[#161d2b]">
                          {beat.mediaType ? (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1a2536] to-[#0f1724] text-xs font-semibold text-muted-foreground">
                              {beat.mediaType === "VIDEO" ? "🎬" : "🖼️"}
                            </div>
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-[#131b28] text-muted-foreground/60">
                              <Sparkles size={14} className="text-[#ff8a00]/60" />
                            </div>
                          )}
                        </div>

                        {/* Beat Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-[#ff8a00]">{beatNumber}</span>
                            <h4 className="truncate text-xs font-semibold text-foreground">
                              {beat.title || `Beat ${beatNumber}`}
                            </h4>
                          </div>
                          <p className="mt-0.5 line-clamp-1 text-[11px] leading-4 text-muted-foreground">
                            {beat.visualIntent || "Chưa có mô tả bối cảnh và ý đồ hình ảnh."}
                          </p>
                        </div>

                        {/* Duration Badge */}
                        <div className="shrink-0 font-mono text-[11px] text-muted-foreground">
                          {formatDurationSeconds(beat.durationMs)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {!hierarchy.length && (
          <div className="p-6 text-center text-xs text-muted-foreground">
            Không tìm thấy chapter hoặc visual beat nào.
          </div>
        )}

        {/* Add Chapter Button */}
        <button
          type="button"
          onClick={onAddChapter}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-[#101622]/60 text-xs font-medium text-muted-foreground transition hover:border-[#ff8a00]/60 hover:bg-[#161f2e] hover:text-[#ff8a00]"
        >
          <Plus size={14} />
          <span>Add Chapter</span>
        </button>
      </div>
    </aside>
  );
}

function formatDurationMinutes(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatDurationSeconds(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

