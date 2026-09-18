import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  Film,
  Filter,
  Info,
  LayoutGrid,
  ListTree,
  Play,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import type { DesktopTimelineBeat } from "@narrativex/client-contracts";
import { Input } from "@/components/ui/input";
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
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(() => new Set());

  // Expand chapter containing the selected beat by default
  useEffect(() => {
    if (!selectedBeatId) return;
    for (const group of hierarchy) {
      if (group.beats.some((b) => b.visualBeatId === selectedBeatId)) {
        setExpandedChapters((prev) => {
          const next = new Set(prev);
          next.add(group.chapter.chapterId);
          return next;
        });
        break;
      }
    }
  }, [hierarchy, selectedBeatId]);

  const toggleChapterExpanded = (chapterId: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  const totalDurationMs = useMemo(
    () => hierarchy.reduce((total, group) => total + Math.max(0, group.chapter.endMs - group.chapter.startMs), 0),
    [hierarchy],
  );

  const chaptersList = useMemo(() => {
    if (hierarchy.length > 0) {
      return hierarchy.map((group, index) => {
        const chapterNumber = String(group.chapter.orderIndex + 1 || index + 1).padStart(2, "0");
        const startSecs = formatTimeSecs(group.chapter.startMs);
        const endSecs = formatTimeSecs(group.chapter.endMs);
        const hasSelectedBeat = group.beats.some((beat) => beat.visualBeatId === selectedBeatId);
        const firstBeat = group.beats[0] ?? null;
        const totalStoryBeats = group.scenes.reduce((acc, s) => acc + (s.storyBeats?.length ?? 0), 0);

        return {
          id: group.chapter.chapterId,
          number: chapterNumber,
          title: group.chapter.title || `Chapter ${chapterNumber}`,
          timeRange: `${startSecs} - ${endSecs}`,
          isActive: hasSelectedBeat,
          firstBeat,
          scenes: group.scenes,
          totalVisualBeats: group.beats.length,
          totalStoryBeats,
        };
      });
    }

    return [];
  }, [hierarchy, selectedBeatId]);

  return (
    <aside className="nx-editor-explorer relative flex h-full min-h-0 flex-col border-r border-border-subtle bg-surface-panel text-foreground">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle px-4">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold tracking-tight text-foreground">Project Explorer</h3>
          <p className="mt-0.5 text-[12px] text-text-dim">{chaptersList.length} chapters</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="nx-icon-button size-7 text-text-muted hover:text-foreground"
          aria-label="Collapse Explorer"
        >
          <ChevronsLeft size={16} strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 border-b border-border-subtle px-3 py-2.5">
        <div className="relative flex min-w-0 flex-1 items-center">
          <Search size={14} className="pointer-events-none absolute left-2.5 text-text-muted" />
          <Input
            className="pl-8 pr-2.5 text-[13px]"
            placeholder="Search chapters, beats or media..."
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="nx-icon-button size-8 border border-border-subtle bg-surface-input hover:border-border-dark hover:bg-surface-2"
          title="Filter"
          aria-label="Filter"
        >
          <Filter size={14} />
        </button>
        <button
          type="button"
          onClick={() => setViewMode((mode) => (mode === "list" ? "grid" : "list"))}
          className={`nx-icon-button size-8 border bg-surface-input hover:border-border-dark hover:bg-surface-2 ${
            viewMode === "grid" ? "border-border-dark text-text-secondary" : "border-border-subtle"
          }`}
          title={viewMode === "list" ? "Switch to Grid view" : "Switch to Tree view"}
          aria-label="Toggle view mode"
          aria-pressed={viewMode === "grid"}
        >
          {viewMode === "list" ? <ListTree size={14} /> : <LayoutGrid size={14} />}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2 pb-24">
        {viewMode === "grid" ? (
          <div className="grid grid-cols-2 gap-1.5 max-[960px]:grid-cols-1">
            {chaptersList.map((chapter) => {
              const isActive = chapter.isActive;

              return (
                <button
                  key={chapter.id}
                  type="button"
                  onClick={() => {
                    if (chapter.firstBeat) onSelectBeat(chapter.firstBeat);
                  }}
                  className={`group relative flex min-h-[58px] w-full items-center rounded-md border px-3 py-2 text-left transition-[background-color,border-color,color] duration-150 ${
                    isActive
                      ? "border-primary/20 bg-primary-muted text-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
                      : "border-transparent bg-transparent hover:border-border-subtle hover:bg-surface-2"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="grid size-6 shrink-0 place-items-center">
                      {isActive ? (
                        <span className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                          <Play size={10} className="ml-0.5 fill-current" />
                        </span>
                      ) : (
                        <span className="grid size-5 place-items-center rounded-full border border-border-subtle text-text-dim transition-colors group-hover:border-border-dark group-hover:text-text-muted">
                          <Info size={11} />
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-mono text-[11px] font-semibold ${isActive ? "text-primary" : "text-text-dim"}`}>
                          {chapter.number}
                        </span>
                        <span className={`truncate text-[13px] font-medium ${isActive ? "text-foreground" : "text-text-secondary"}`}>
                          {chapter.title}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-text-dim font-mono">
                        <span>{chapter.timeRange}</span>
                        <span>·</span>
                        <span>{chapter.totalVisualBeats} beats</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1.5">
            {chaptersList.map((chapter) => {
              const isExpanded = expandedChapters.has(chapter.id);
              const isActive = chapter.isActive;

              return (
                <div key={chapter.id} className="rounded-md border border-border-subtle/70 bg-surface-1/40 overflow-hidden">
                  {/* Chapter Header */}
                  <div
                    className={`flex items-center justify-between px-2.5 py-2 cursor-pointer transition-colors ${
                      isActive ? "bg-primary-muted/50 text-foreground" : "hover:bg-surface-2/60 text-text-secondary"
                    }`}
                    onClick={() => toggleChapterExpanded(chapter.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        aria-label={isExpanded ? "Collapse chapter" : "Expand chapter"}
                        className="text-text-muted hover:text-foreground shrink-0"
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      <span className={`font-mono text-[11px] font-semibold ${isActive ? "text-primary" : "text-text-dim"}`}>
                        {chapter.number}
                      </span>
                      <span className="truncate text-[13px] font-medium text-foreground">
                        {chapter.title}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-text-dim pl-2">
                      {chapter.timeRange}
                    </span>
                  </div>

                  {/* Expanded Content: Scenes -> StoryBeats -> VisualBeats */}
                  {isExpanded && (
                    <div className="border-t border-border-subtle/50 px-2 py-2 space-y-2 bg-background/25">
                      {chapter.scenes.length === 0 && (
                        <p className="text-[12px] text-text-dim py-1 text-center italic">
                          Chưa có scene nào.
                        </p>
                      )}

                      {chapter.scenes.map((scene) => (
                        <div key={`${chapter.id}-scene-${scene.sceneIndex}`} className="space-y-1">
                          <div className="flex items-center justify-between text-[12px] font-medium text-text-muted px-1.5 pt-0.5">
                            <span className="uppercase tracking-wider text-[10px] text-text-dim font-mono">
                              Scene {scene.sceneIndex + 1}
                            </span>
                            <span className="font-mono text-[11px] text-text-dim">
                              {formatTimeSecs(scene.durationMs)}
                            </span>
                          </div>

                          {/* StoryBeats Grouping */}
                          {(scene.storyBeats ?? []).map((storyBeat, sbIdx) => (
                            <div
                              key={`${chapter.id}-sb-${storyBeat.storyBeatId ?? sbIdx}`}
                              className="rounded border border-border-subtle/40 bg-surface-dark/40 p-1.5 space-y-1"
                            >
                              <div className="flex items-center justify-between text-[11px] text-text-dim px-1 font-mono">
                                <span className="flex items-center gap-1 font-sans text-[11px] font-medium text-text-secondary">
                                  <Sparkles size={11} className="text-primary/70 shrink-0" />
                                  {storyBeat.storyBeatId ? `StoryBeat ${sbIdx + 1}` : "Direct Beats"}
                                </span>
                                <span>{storyBeat.beats.length} visual {storyBeat.beats.length === 1 ? "beat" : "beats"}</span>
                              </div>

                              {/* Visual Beats */}
                              <div className="space-y-0.5 pl-1">
                                {storyBeat.beats.map((beat) => {
                                  const isBeatSelected = beat.visualBeatId === selectedBeatId;
                                  return (
                                    <button
                                      key={beat.visualBeatId}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectBeat(beat);
                                      }}
                                      className={`flex w-full items-center justify-between rounded px-2 py-1 text-left transition-colors ${
                                        isBeatSelected
                                          ? "bg-primary-muted text-primary font-medium ring-1 ring-primary/40"
                                          : "hover:bg-surface-2 text-text-secondary hover:text-foreground"
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <Film size={12} className={isBeatSelected ? "text-primary" : "text-text-muted"} />
                                        <span className="truncate text-[12px]">
                                          {beat.title || `Beat ${beat.beatIndex + 1}`}
                                        </span>
                                      </div>
                                      <span className="font-mono text-[11px] text-text-dim shrink-0 pl-1">
                                        {formatTimeSecs(beat.durationMs)}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {chaptersList.length === 0 && (
          <div className="col-span-full border-y border-dashed border-border-subtle px-4 py-7 text-center" role="status">
            <p className="text-[13px] font-medium text-text-secondary">
              {query.trim() ? "Không tìm thấy chapter phù hợp." : "Chưa có chapter nào."}
            </p>
            <p className="mt-1 text-[12px] leading-4 text-text-dim">
              {query.trim() ? "Thử thay đổi từ khóa tìm kiếm." : "Tạo chapter trong tab Chapters để bắt đầu biên tập."}
            </p>
          </div>
        )}

        {onAddChapter && (
          <button
            type="button"
            onClick={onAddChapter}
            className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border-subtle text-[12px] font-medium text-text-muted transition-[background-color,border-color,color] duration-150 hover:border-border-dark hover:bg-surface-2 hover:text-foreground"
          >
            <Plus size={14} aria-hidden="true" />
            <span>Add Chapter</span>
          </button>
        )}
      </div>

      <div className="nx-project-info absolute inset-x-0 bottom-0 z-10 border-t border-border-subtle bg-surface-panel px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-[13px] font-semibold text-foreground">Project Info</h4>
          <span className="font-mono text-[12px] text-text-dim">
            {totalDurationMs > 0 ? formatDurationTimecode(totalDurationMs) : "01:30.00"}
          </span>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
          <InfoPair label="Resolution" value="1920 × 1080" />
          <InfoPair label="Frame Rate" value="24 fps" />
          <InfoPair label="Aspect Ratio" value="16:9" />
          <InfoPair label="Chapters" value={String(chaptersList.length)} />
        </div>
      </div>
    </aside>
  );
}

function InfoPair({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <span className="text-text-dim">{label}</span>
      <span className="truncate text-right font-medium text-text-secondary">{value}</span>
    </div>
  );
}

function formatTimeSecs(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatDurationTimecode(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}

