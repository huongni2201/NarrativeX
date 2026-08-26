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
    setCollapsedChapters((previous) => ({
      ...previous,
      [chapterId]: !previous[chapterId],
    }));
  };

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-border-subtle bg-surface-panel">
      <div className="nx-panel-header flex items-center justify-between px-3">
        <h3 className="text-[11px] font-bold text-foreground">Project Explorer</h3>
        <button
          type="button"
          onClick={onClose}
          className="nx-icon-button size-6"
          aria-label="Close Explorer"
        >
          <X size={12} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 border-b border-border-subtle p-2">
        <div className="relative flex min-w-0 flex-1 items-center">
          <Search size={12} className="pointer-events-none absolute left-2.5 text-text-muted" />
          <input
            type="text"
            className="nx-compact-control h-8 w-full pl-8 pr-2 text-[10px] placeholder:text-text-dim focus:border-primary focus:outline-none"
            placeholder="Search beats or chapters..."
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="nx-compact-control grid size-8 place-items-center text-text-muted"
          title="Filter"
          aria-label="Filter"
        >
          <Filter size={12} />
        </button>
        <button
          type="button"
          className="nx-compact-control grid size-8 place-items-center text-text-muted"
          title="Layout view"
          aria-label="Layout view"
        >
          <LayoutGrid size={12} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2.5">
        {hierarchy.map((group) => {
          const isCollapsed = Boolean(collapsedChapters[group.chapter.chapterId]);
          const chapterDurationMs = Math.max(0, group.chapter.endMs - group.chapter.startMs);

          return (
            <div key={group.chapter.chapterId} className="space-y-1">
              <button
                type="button"
                className="flex h-7 w-full items-center justify-between rounded-sm px-1 text-left transition hover:bg-surface-2"
                onClick={() => toggleChapter(group.chapter.chapterId)}
              >
                <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-text-muted">
                  {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                  <span>Chapter {String(group.chapter.orderIndex + 1).padStart(2, "0")}</span>
                </div>
                <span className="font-mono text-[9px] text-text-dim">
                  {formatDurationMinutes(chapterDurationMs)}
                </span>
              </button>

              {!isCollapsed && (
                <div className="space-y-1">
                  {group.scenes.flatMap((scene) => scene.beats).map((beat) => {
                    const isSelected = beat.visualBeatId === selectedBeatId;
                    const beatNumber = String(beat.beatIndex + 1).padStart(2, "0");

                    return (
                      <button
                        key={beat.visualBeatId}
                        type="button"
                        onClick={() => onSelectBeat(beat)}
                        className={`group flex w-full items-center gap-2 rounded-md border p-1.5 text-left transition-colors ${
                          isSelected
                            ? "border-primary/65 bg-primary-muted shadow-[var(--shadow-primary)]"
                            : "border-border-subtle bg-surface hover:border-border-dark hover:bg-surface-2"
                        }`}
                      >
                        <div className="nx-media-placeholder relative h-10 w-14 shrink-0 overflow-hidden rounded-sm border border-border-subtle">
                          <span className="absolute bottom-1 left-1 rounded-sm bg-background/80 px-1 font-mono text-[8px] text-text-secondary">
                            {beat.mediaType === "VIDEO" ? "VID" : beat.mediaType === "IMAGE" ? "IMG" : "AI"}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-sm bg-primary px-1 py-0.5 text-[8px] font-bold text-primary-foreground">
                              {beatNumber}
                            </span>
                            <span className={`truncate text-[10px] font-medium ${isSelected ? "text-primary-hover" : "text-foreground"}`}>
                              {beat.title || `Beat ${beatNumber}`}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-[9px] text-text-dim">
                            {beat.cameraMovement || beat.visualIntent || "Visual beat"}
                          </p>
                        </div>

                        <span className="shrink-0 font-mono text-[9px] text-text-muted">
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
          <div className="rounded-md border border-dashed border-border p-5 text-center text-[10px] text-text-muted">
            Không tìm thấy chapter hoặc visual beat nào.
          </div>
        )}

        <button
          type="button"
          onClick={onAddChapter}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-surface text-[10px] font-medium text-text-muted transition hover:border-primary/50 hover:bg-primary-muted hover:text-primary-hover"
        >
          <Plus size={12} />
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
