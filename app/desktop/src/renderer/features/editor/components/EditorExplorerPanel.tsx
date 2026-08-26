import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Filter,
  LayoutGrid,
  Plus,
  Search,
  X,
} from "lucide-react";
import type { DesktopTimelineBeat } from "@narrativex/client-contracts";
import type { EditorChapterGroup } from "../editor-timeline";

interface EditorExplorerPanelProps {
  hierarchy: EditorChapterGroup[];
  selectedBeatId: string;
  onSelectBeat: (beat: DesktopTimelineBeat) => void;
  query: string;
  onQueryChange: (query: string) => void;
  onAddChapter?: () => void;
  onClose?: () => void;
}

export function EditorExplorerPanel({
  hierarchy,
  selectedBeatId,
  onSelectBeat,
  query,
  onQueryChange,
  onAddChapter,
  onClose,
}: Readonly<EditorExplorerPanelProps>) {
  const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>({});

  const toggleChapter = (chapterId: string) => {
    setCollapsedChapters((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-border/60 bg-[#0b0f17]">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-3.5 py-3">
        <h3 className="text-xs font-bold text-foreground">Project Explorer</h3>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition hover:bg-[#141d2a] hover:text-foreground"
          aria-label="Close Explorer"
        >
          <X size={13} />
        </button>
      </div>

      {/* Search & Tool Icons */}
      <div className="flex items-center gap-1.5 border-b border-border/40 p-2.5">
        <div className="relative flex flex-1 items-center">
          <Search size={13} className="pointer-events-none absolute left-2.5 text-muted-foreground" />
          <input
            type="text"
            className="h-8 w-full rounded-lg border border-border/60 bg-[#0f1522] pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-[#ff8a00]/70 focus:outline-none"
            placeholder="Search beats or chapters..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-[#0f1522] text-muted-foreground transition hover:text-foreground"
          title="Filter"
          aria-label="Filter"
        >
          <Filter size={13} />
        </button>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-[#0f1522] text-muted-foreground transition hover:text-foreground"
          title="Layout view"
          aria-label="Layout view"
        >
          <LayoutGrid size={13} />
        </button>
      </div>

      {/* Chapters & Beats List */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border/40">
        {hierarchy.map((group) => {
          const isCollapsed = Boolean(collapsedChapters[group.chapter.chapterId]);
          const chapterDurationMs = Math.max(0, group.chapter.endMs - group.chapter.startMs);

          return (
            <div key={group.chapter.chapterId} className="space-y-1.5">
              {/* Chapter Accordion Header */}
              <button
                type="button"
                className="flex w-full items-center justify-between px-1 py-1 text-left text-xs transition hover:text-foreground"
                onClick={() => toggleChapter(group.chapter.chapterId)}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-muted-foreground hover:text-foreground uppercase">
                  {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                  <span>CHAPTER {String(group.chapter.orderIndex + 1).padStart(2, "0")}</span>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {formatDurationMinutes(chapterDurationMs)}
                </span>
              </button>

              {/* Beats within Chapter */}
              {!isCollapsed && (
                <div className="space-y-1.5">
                  {group.scenes.flatMap((scene) => scene.beats).map((beat) => {
                    const isSelected = beat.visualBeatId === selectedBeatId;
                    const beatNumber = String(beat.beatIndex + 1).padStart(2, "0");

                    return (
                      <button
                        key={beat.visualBeatId}
                        type="button"
                        onClick={() => onSelectBeat(beat)}
                        className={`group relative flex w-full items-center gap-2.5 rounded-xl border p-2 text-left transition-all duration-150 ${
                          isSelected
                            ? "border-[#ff8a00] bg-[#141822] shadow-[0_0_12px_rgba(255,138,0,0.25)] ring-1 ring-[#ff8a00]"
                            : "border-border/40 bg-[#0d121c]/90 hover:border-border/80 hover:bg-[#121826]"
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="relative h-11 w-14 shrink-0 overflow-hidden rounded-lg border border-border/50 bg-[#161f30]">
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1a2538] via-[#101928] to-[#0a101b] text-xs">
                            <div className="h-full w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/40 via-purple-900/20 to-black" />
                          </div>
                        </div>

                        {/* Title & Badge */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded bg-[#ff8a00] px-1 py-0.2 text-[9px] font-bold text-black">
                              {beatNumber}
                            </span>
                            <span className="truncate text-xs font-medium text-foreground">
                              {beat.title || `Beat ${beatNumber}`}
                            </span>
                          </div>
                        </div>

                        {/* Duration */}
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {formatDurationSeconds(beat.durationMs)}
                        </span>
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
          className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/70 bg-[#0d121c]/60 text-xs font-medium text-muted-foreground transition hover:border-[#ff8a00]/60 hover:bg-[#141b27] hover:text-[#ff8a00]"
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
