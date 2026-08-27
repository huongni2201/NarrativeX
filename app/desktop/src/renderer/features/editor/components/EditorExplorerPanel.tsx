import { useMemo, useState } from "react";
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
  const totalDurationMs = useMemo(
    () => hierarchy.reduce((total, group) => total + Math.max(0, group.chapter.endMs - group.chapter.startMs), 0),
    [hierarchy],
  );
  const totalBeats = useMemo(
    () => hierarchy.reduce((total, group) => total + group.scenes.reduce((sceneTotal, scene) => sceneTotal + scene.beats.length, 0), 0),
    [hierarchy],
  );

  const toggleChapter = (chapterId: string) => {
    setCollapsedChapters((previous) => ({
      ...previous,
      [chapterId]: !previous[chapterId],
    }));
  };

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-border-subtle bg-surface-panel">
      <div className="nx-panel-header flex items-center justify-between px-4">
        <div>
          <h3 className="text-[12px] font-semibold text-foreground">Project Explorer</h3>
          <p className="mt-0.5 text-[9px] text-text-dim">Chapter → Scene → Visual Beat</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="nx-icon-button size-7"
          aria-label="Close Explorer"
        >
          <X size={13} />
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-border-subtle p-3">
        <div className="relative flex min-w-0 flex-1 items-center">
          <Search size={13} className="pointer-events-none absolute left-3 text-text-muted" />
          <input
            type="text"
            className="nx-compact-control h-9 w-full pl-9 pr-3 text-[10px] placeholder:text-text-dim focus:border-primary focus:outline-none"
            placeholder="Search chapters, scenes or beats..."
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="nx-compact-control grid size-9 place-items-center text-text-muted"
          title="Filter"
          aria-label="Filter"
        >
          <Filter size={13} />
        </button>
        <button
          type="button"
          className="nx-compact-control grid size-9 place-items-center text-text-muted"
          title="Layout view"
          aria-label="Layout view"
        >
          <LayoutGrid size={13} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 p-3">
          {hierarchy.map((group) => {
            const isCollapsed = Boolean(collapsedChapters[group.chapter.chapterId]);
            const chapterDurationMs = Math.max(0, group.chapter.endMs - group.chapter.startMs);

            return (
              <section key={group.chapter.chapterId} className="overflow-hidden rounded-lg border border-border-subtle bg-surface">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-surface-2"
                  onClick={() => toggleChapter(group.chapter.chapterId)}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    {isCollapsed ? <ChevronRight size={13} className="text-text-muted" /> : <ChevronDown size={13} className="text-text-muted" />}
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-primary-hover">
                        Chapter {String(group.chapter.orderIndex + 1).padStart(2, "0")}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] font-medium text-foreground">{group.chapter.title}</p>
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-[9px] text-text-dim">
                    {formatDurationMinutes(chapterDurationMs)}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="space-y-3 border-t border-border-subtle p-2.5">
                    {group.scenes.map((scene) => (
                      <div key={`${group.chapter.chapterId}:${scene.sceneIndex}`} className="space-y-1.5">
                        <div className="flex items-center justify-between px-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-text-dim">
                          <span>Scene {String(scene.sceneIndex + 1).padStart(2, "0")}</span>
                          <span>{scene.beats.length} beat{scene.beats.length === 1 ? "" : "s"}</span>
                        </div>

                        {scene.beats.map((beat) => {
                          const isSelected = beat.visualBeatId === selectedBeatId;
                          const beatNumber = String(beat.beatIndex + 1).padStart(2, "0");

                          return (
                            <button
                              key={beat.visualBeatId}
                              type="button"
                              onClick={() => onSelectBeat(beat)}
                              className={`group flex w-full items-center gap-2.5 rounded-md border p-2 text-left transition-colors ${
                                isSelected
                                  ? "border-primary/65 bg-primary-muted shadow-[var(--shadow-primary)]"
                                  : "border-border-subtle bg-background hover:border-border-dark hover:bg-surface-2"
                              }`}
                            >
                              <div className="nx-media-placeholder relative h-12 w-16 shrink-0 overflow-hidden rounded-md border border-border-subtle">
                                <span className="absolute bottom-1 left-1 rounded-sm bg-background/80 px-1.5 py-0.5 font-mono text-[8px] text-text-secondary">
                                  {beat.mediaType === "VIDEO" ? "VID" : beat.mediaType === "IMAGE" ? "IMG" : "AI"}
                                </span>
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="rounded-sm bg-primary px-1.5 py-0.5 text-[8px] font-bold text-primary-foreground">
                                    {beatNumber}
                                  </span>
                                  <span className={`truncate text-[10px] font-medium ${isSelected ? "text-primary-hover" : "text-foreground"}`}>
                                    {beat.title || `Beat ${beatNumber}`}
                                  </span>
                                </div>
                                <p className="mt-1.5 truncate text-[9px] text-text-dim">
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
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          {!hierarchy.length && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-[10px] leading-5 text-text-muted">
              Không tìm thấy chapter, scene hoặc visual beat nào.
            </div>
          )}

          <button
            type="button"
            onClick={onAddChapter}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface text-[10px] font-medium text-text-muted transition hover:border-primary/50 hover:bg-primary-muted hover:text-primary-hover"
          >
            <Plus size={13} />
            <span>Add Chapter</span>
          </button>
        </div>
      </div>

      <div className="border-t border-border-subtle p-3">
        <div className="rounded-lg border border-border-subtle bg-surface p-3">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-text-dim">Project Info</span>
            <span className="text-[9px] text-text-muted">Review workspace</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <InfoCell label="Chapters" value={String(hierarchy.length)} />
            <InfoCell label="Visual beats" value={String(totalBeats)} />
            <InfoCell label="Duration" value={formatDurationMinutes(totalDurationMs)} />
            <InfoCell label="Clock" value="Narration" />
          </div>
        </div>
      </div>
    </aside>
  );
}

function InfoCell({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-md border border-border-subtle bg-background px-2.5 py-2">
      <span className="block text-[8px] uppercase tracking-wider text-text-dim">{label}</span>
      <strong className="mt-1 block truncate text-[10px] font-medium text-text-secondary">{value}</strong>
    </div>
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
